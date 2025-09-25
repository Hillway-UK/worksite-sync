/**
 * SECURITY: Security Middleware
 * Implements OWASP Top 10 security controls and monitoring
 * Provides CSRF protection, XSS filtering, and security event logging
 */

import { secureError, secureLog } from '@/lib/validation';
import { isProduction, maskSensitiveData } from '@/lib/environment';

/**
 * SECURITY: CSRF Token Management
 * Prevents Cross-Site Request Forgery attacks
 */
class CSRFProtection {
  private static instance: CSRFProtection;
  private token: string | null = null;
  
  static getInstance(): CSRFProtection {
    if (!CSRFProtection.instance) {
      CSRFProtection.instance = new CSRFProtection();
    }
    return CSRFProtection.instance;
  }
  
  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this.token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Store in secure cookie-like storage
    sessionStorage.setItem('csrf_token', this.token);
    
    secureLog('CSRF token generated');
    return this.token;
  }
  
  /**
   * Validate CSRF token
   */
  validateToken(providedToken: string): boolean {
    const storedToken = sessionStorage.getItem('csrf_token');
    
    if (!storedToken || !providedToken) {
      secureError('CSRF validation failed: missing token');
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    if (storedToken.length !== providedToken.length) {
      secureError('CSRF validation failed: invalid token length');
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < storedToken.length; i++) {
      result |= storedToken.charCodeAt(i) ^ providedToken.charCodeAt(i);
    }
    
    const isValid = result === 0;
    if (!isValid) {
      secureError('CSRF validation failed: token mismatch');
    }
    
    return isValid;
  }
  
  /**
   * Get current token for form submission
   */
  getToken(): string {
    return this.token || this.generateToken();
  }
}

/**
 * SECURITY: XSS Protection
 * Filters and sanitizes potentially malicious content
 */
export class XSSProtection {
  private static readonly DANGEROUS_PATTERNS = [
    // Script injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    
    // Event handlers
    /on\w+\s*=\s*["\'][^"\']*["\']/gi,
    
    // JavaScript URLs
    /javascript\s*:/gi,
    
    // Data URLs with scripts
    /data\s*:\s*text\/html/gi,
    
    // HTML entities that could be dangerous
    /&#x?[0-9a-f]+;?/gi,
    
    // CSS expressions
    /expression\s*\(/gi,
    
    // Import statements
    /@import/gi,
    
    // Vbscript
    /vbscript\s*:/gi
  ];
  
  /**
   * Sanitize HTML content
   */
  static sanitizeHTML(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    let sanitized = input;
    
    // Remove dangerous patterns
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    // Additional character filtering
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, '&#39;') // Escape quotes
      .trim();
    
    // Log potential XSS attempts
    if (sanitized !== input) {
      secureError('Potential XSS attempt detected and blocked', {
        original: input.substring(0, 100) + '...',
        sanitized: sanitized.substring(0, 100) + '...'
      });
    }
    
    return sanitized;
  }
  
  /**
   * Validate URL for safety
   */
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        secureError('Unsafe URL protocol detected', { url, protocol: parsed.protocol });
        return false;
      }
      
      // Block localhost in production
      if (isProduction && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        secureError('Localhost URL blocked in production', { url });
        return false;
      }
      
      return true;
    } catch (error) {
      secureError('Invalid URL format', { url, error });
      return false;
    }
  }
}

/**
 * SECURITY: Security Event Monitoring
 * Tracks and logs security-related events for analysis
 */
export class SecurityMonitor {
  private static events: SecurityEvent[] = [];
  private static readonly MAX_EVENTS = 1000;
  
  static logSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'id'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      metadata: maskSensitiveData(event.metadata || {})
    };
    
    this.events.push(securityEvent);
    
    // Maintain circular buffer
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
    
    // Log critical events immediately
    if (event.severity === 'critical' || event.severity === 'high') {
      secureError('Security Event', securityEvent);
    } else {
      secureLog('Security Event', securityEvent);
    }
    
    // In production, send to monitoring service
    if (isProduction) {
      this.sendToMonitoringService(securityEvent);
    }
  }
  
  /**
   * Get security events for dashboard
   */
  static getEvents(filter?: {
    severity?: SecurityEvent['severity'];
    type?: SecurityEvent['type'];
    since?: string;
  }): SecurityEvent[] {
    let filtered = [...this.events];
    
    if (filter?.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }
    
    if (filter?.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }
    
    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= sinceDate);
    }
    
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  /**
   * Get security metrics
   */
  static getMetrics(): SecurityMetrics {
    const recentEvents = this.getEvents({ 
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
    });
    
    const severityCounts = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const typeCounts = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalEvents: this.events.length,
      recentEvents: recentEvents.length,
      severityCounts,
      typeCounts,
      lastEvent: this.events[this.events.length - 1]?.timestamp || null
    };
  }
  
  private static async sendToMonitoringService(event: SecurityEvent): Promise<void> {
    // In a real application, this would send to services like:
    // - Sentry for error tracking
    // - DataDog for metrics
    // - AWS CloudWatch for logging
    // - Custom webhook endpoints
    
    try {
      // Placeholder for monitoring service integration
      secureLog('Would send to monitoring service', { eventId: event.id });
    } catch (error) {
      secureError('Failed to send security event to monitoring service', { 
        eventId: event.id, 
        error 
      });
    }
  }
}

/**
 * SECURITY: Request validation middleware
 */
export class RequestValidator {
  /**
   * Validate request headers for security
   */
  static validateHeaders(headers: Record<string, string>): ValidationResult {
    const issues: string[] = [];
    
    // Check for required security headers
    const requiredHeaders = ['content-type'];
    for (const header of requiredHeaders) {
      if (!headers[header.toLowerCase()]) {
        issues.push(`Missing required header: ${header}`);
      }
    }
    
    // Validate content-type
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      issues.push('Unsupported content-type');
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = Object.keys(headers).filter(header =>
      header.toLowerCase().includes('script') ||
      header.toLowerCase().includes('eval') ||
      header.toLowerCase().includes('expression')
    );
    
    if (suspiciousHeaders.length > 0) {
      issues.push(`Suspicious headers detected: ${suspiciousHeaders.join(', ')}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * Validate request body for security
   */
  static validateBody(body: any): ValidationResult {
    const issues: string[] = [];
    
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        issues.push('Invalid JSON format');
        return { valid: false, issues };
      }
    }
    
    // Check for dangerous content
    const serialized = JSON.stringify(body);
    
    if (serialized.length > 10 * 1024 * 1024) { // 10MB limit
      issues.push('Request body too large');
    }
    
    // Check for script injections
    if (/<script|javascript:|on\w+\s*=/i.test(serialized)) {
      issues.push('Potential script injection detected');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Types
interface SecurityEvent {
  id: string;
  timestamp: string;
  type: 'authentication' | 'authorization' | 'input_validation' | 'rate_limit' | 'xss_attempt' | 'csrf_violation' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SecurityMetrics {
  totalEvents: number;
  recentEvents: number;
  severityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  lastEvent: string | null;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// Export singleton instances
export const csrfProtection = CSRFProtection.getInstance();
export const securityMonitor = SecurityMonitor;