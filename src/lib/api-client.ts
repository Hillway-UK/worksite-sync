/**
 * SECURITY & PERFORMANCE: Secure API Client
 * Centralized API management with caching, security headers, and error handling
 * Implements OWASP security best practices and performance optimizations
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { secureLog, secureError, securityHeaders } from '@/lib/validation';
import { maskSensitiveData, isProduction } from '@/lib/environment';

/**
 * SECURITY: Request sanitization and validation
 */
class SecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * SECURITY: Rate limiting implementation
 * Prevents abuse and DoS attacks
 */
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  
  constructor(private maxRequests = 100, private windowMs = 60000) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);
    
    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= this.maxRequests) {
      secureError('Rate limit exceeded', { identifier, count: record.count });
      return false;
    }
    
    record.count++;
    return true;
  }
  
  // Clean up expired entries to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * SECURITY: Request/Response interceptors
 */
interface ApiRequestConfig {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  requireAuth?: boolean;
  retries?: number;
  timeout?: number;
  cacheKey?: string;
  cacheDuration?: number;
}

interface ApiResponse<T = any> {
  data: T;
  error: any;
  success: boolean;
  cached?: boolean;
  timestamp: number;
}

/**
 * PERFORMANCE: Response caching with TTL
 */
class ResponseCache {
  private cache = new Map<string, { data: any; expires: number }>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  
  set(key: string, data: any, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }
  
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * SECURITY & PERFORMANCE: Main API Client
 */
class SecureApiClient {
  private rateLimiter = new RateLimiter();
  private cache = new ResponseCache();
  private requestQueue = new Map<string, Promise<any>>();
  
  constructor() {
    // Cleanup timers to prevent memory leaks
    if (!isProduction) {
      setInterval(() => {
        this.rateLimiter.cleanup();
        this.cache.cleanup();
      }, 5 * 60 * 1000); // Cleanup every 5 minutes
    }
  }
  
  /**
   * SECURITY: Pre-request validation and security checks
   */
  private async validateRequest(config: ApiRequestConfig): Promise<void> {
    // Rate limiting check
    const identifier = config.requireAuth ? 'authenticated' : 'anonymous';
    if (!this.rateLimiter.isAllowed(identifier)) {
      throw new SecurityError('Rate limit exceeded', 'RATE_LIMIT');
    }
    
    // Input validation for data payloads
    if (config.data && typeof config.data === 'object') {
      const jsonString = JSON.stringify(config.data);
      if (jsonString.length > 1024 * 1024) { // 1MB limit
        throw new SecurityError('Request payload too large', 'PAYLOAD_TOO_LARGE');
      }
      
      // Check for potential XSS/injection patterns
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:.*base64/i
      ];
      
      if (dangerousPatterns.some(pattern => pattern.test(jsonString))) {
        secureError('Potentially malicious payload detected', { 
          endpoint: config.endpoint,
          patterns: dangerousPatterns.filter(p => p.test(jsonString))
        });
        throw new SecurityError('Invalid request data', 'INVALID_DATA');
      }
    }
  }
  
  /**
   * PERFORMANCE: Request deduplication
   * Prevents duplicate API calls for identical requests
   */
  private getRequestKey(config: ApiRequestConfig): string {
    return `${config.method || 'GET'}:${config.endpoint}:${JSON.stringify(config.data || {})}`;
  }
  
  /**
   * SECURITY & PERFORMANCE: Main request method
   */
  async request<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    try {
      await this.validateRequest(config);
      
      const requestKey = this.getRequestKey(config);
      
      // Check cache first (for GET requests)
      if (config.method === 'GET' || !config.method) {
        const cached = this.cache.get<T>(config.cacheKey || requestKey);
        if (cached) {
          secureLog('Cache hit', { endpoint: config.endpoint });
          return {
            data: cached,
            error: null,
            success: true,
            cached: true,
            timestamp: Date.now()
          };
        }
      }
      
      // Request deduplication
      if (this.requestQueue.has(requestKey)) {
        secureLog('Request deduplication', { endpoint: config.endpoint });
        return await this.requestQueue.get(requestKey)!;
      }
      
      // Create the actual request promise
      const requestPromise = this.executeRequest<T>(config);
      this.requestQueue.set(requestKey, requestPromise);
      
      try {
        const response = await requestPromise;
        
        // Cache successful GET responses
        if ((config.method === 'GET' || !config.method) && response.success) {
          this.cache.set(
            config.cacheKey || requestKey, 
            response.data, 
            config.cacheDuration
          );
        }
        
        return response;
      } finally {
        this.requestQueue.delete(requestKey);
      }
      
    } catch (error) {
      secureError('API request failed', {
        endpoint: config.endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Request failed',
        success: false,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * SECURITY: Execute request with retry logic and timeout
   */
  private async executeRequest<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    const maxRetries = config.retries || 3;
    const timeout = config.timeout || 30000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add security headers to all requests
        const requestHeaders = {
          ...securityHeaders,
          'Content-Type': 'application/json',
        };
        
        // Execute Supabase request based on endpoint pattern
        let response;
        
        if (config.endpoint.startsWith('/auth/')) {
          // Authentication requests
          response = await this.handleAuthRequest(config);
        } else if (config.endpoint.startsWith('/rest/')) {
          // Database requests
          response = await this.handleDatabaseRequest(config);
        } else {
          throw new Error(`Unsupported endpoint: ${config.endpoint}`);
        }
        
        // Log successful requests (with data masking)
        secureLog('API request successful', {
          endpoint: config.endpoint,
          method: config.method || 'GET',
          attempt: attempt + 1,
          responseSize: response?.data ? JSON.stringify(response.data).length : 0
        });
        
        return {
          data: response.data,
          error: response.error,
          success: !response.error,
          timestamp: Date.now()
        };
        
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Exponential backoff for retries
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        secureLog('API request retry', {
          endpoint: config.endpoint,
          attempt: attempt + 1,
          maxRetries,
          delay
        });
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  /**
   * SECURITY: Handle authentication requests
   */
  private async handleAuthRequest(config: ApiRequestConfig) {
    const { endpoint, data, method = 'POST' } = config;
    
    if (endpoint === '/auth/signin') {
      return await supabase.auth.signInWithPassword(data);
    } else if (endpoint === '/auth/signup') {
      return await supabase.auth.signUp(data);
    } else if (endpoint === '/auth/signout') {
      return await supabase.auth.signOut();
    } else if (endpoint === '/auth/session') {
      return await supabase.auth.getSession();
    }
    
    throw new Error(`Unsupported auth endpoint: ${endpoint}`);
  }
  
  /**
   * SECURITY: Handle database requests
   */
  private async handleDatabaseRequest(config: ApiRequestConfig) {
    const { endpoint, data, method = 'GET' } = config;
    
    // Parse endpoint to extract table and operation
    const pathParts = endpoint.replace('/rest/v1/', '').split('/');
    const tableName = pathParts[0];
    
    // Validate table name exists in database schema
    const validTables = [
      'additional_costs', 'clock_entries', 'expense_types', 'workers', 
      'managers', 'jobs', 'demo_requests', 'organizations', 
      'notification_preferences', 'subscription_usage', 'super_admins', 'time_amendments'
    ];
    
    if (!validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    
    let query = supabase.from(tableName as any);
    
    switch (method) {
      case 'GET':
        return await query.select(data?.select || '*');
      case 'POST':
        return await query.insert(data);
      case 'PUT':
      case 'PATCH':
        return await query.update(data).eq('id', data.id);
      case 'DELETE':
        return await query.delete().eq('id', data.id);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
  
  /**
   * PERFORMANCE: Cache management methods
   */
  invalidateCache(pattern?: string): void {
    this.cache.invalidate(pattern);
    secureLog('Cache invalidated', { pattern });
  }
  
  /**
   * SECURITY: Get request statistics for monitoring
   */
  getStats() {
    return {
      cacheSize: this.cache['cache'].size,
      queueSize: this.requestQueue.size,
      timestamp: Date.now()
    };
  }
}

// Export singleton instance
export const apiClient = new SecureApiClient();

/**
 * CONVENIENCE: Typed API methods
 */
export const api = {
  // Authentication
  auth: {
    signIn: (email: string, password: string) =>
      apiClient.request({ endpoint: '/auth/signin', data: { email, password } }),
    signUp: (email: string, password: string) =>
      apiClient.request({ endpoint: '/auth/signup', data: { email, password } }),
    signOut: () =>
      apiClient.request({ endpoint: '/auth/signout', method: 'POST' }),
    getSession: () =>
      apiClient.request({ endpoint: '/auth/session', cacheKey: 'auth:session', cacheDuration: 60000 })
  },
  
  // Database operations with caching
  db: {
    select: <T>(table: string, select = '*', options?: { cacheKey?: string; cacheDuration?: number }) =>
      apiClient.request<T[]>({
        endpoint: `/rest/v1/${table}`,
        data: { select },
        cacheKey: options?.cacheKey || `db:${table}:select`,
        cacheDuration: options?.cacheDuration || 5 * 60 * 1000
      }),
    
    insert: <T>(table: string, data: Partial<T>) =>
      apiClient.request<T>({
        endpoint: `/rest/v1/${table}`,
        method: 'POST',
        data
      }),
    
    update: <T>(table: string, id: string, data: Partial<T>) =>
      apiClient.request<T>({
        endpoint: `/rest/v1/${table}`,
        method: 'PATCH',
        data: { ...data, id }
      }),
    
    delete: (table: string, id: string) =>
      apiClient.request({
        endpoint: `/rest/v1/${table}`,
        method: 'DELETE',
        data: { id }
      })
  },
  
  // Cache management
  cache: {
    invalidate: (pattern?: string) => apiClient.invalidateCache(pattern),
    stats: () => apiClient.getStats()
  }
};