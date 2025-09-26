/**
 * PERFORMANCE: Optimized React Query Configuration
 * Implements advanced caching strategies, offline support, and performance monitoring
 * Follows React Query best practices for enterprise applications
 */

import { QueryClient, DefaultOptions, QueryKey } from '@tanstack/react-query';
import { secureLog, secureError } from '@/lib/validation';
import { isProduction } from '@/lib/environment';
import { securityMonitor } from '@/lib/security-middleware';

/**
 * PERFORMANCE: Advanced caching configuration
 * Optimized for both performance and user experience
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Stale-while-revalidate strategy
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
    
    // Network and retry configuration
    networkMode: 'online', // Only run queries when online
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch when component mounts
    
    // Retry configuration with exponential backoff
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 401 || status === 403) {
          securityMonitor.logSecurityEvent({
            type: 'authentication',
            severity: 'medium',
            message: `Authentication error during query: ${status}`,
            metadata: { status, failureCount }
          });
          return false;
        }
      }
      
      // Exponential backoff: retry up to 3 times
      return failureCount < 3;
    },
    
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Error handling
    throwOnError: false, // Handle errors gracefully in components
  },
  
  mutations: {
    // Network configuration for mutations
    networkMode: 'online',
    
    // Retry failed mutations once
    retry: 1,
    retryDelay: 1000,
    
    // Don't throw errors by default
    throwOnError: false,
  }
};

/**
 * PERFORMANCE: Smart query key factory
 * Provides consistent and optimized query keys
 */
export const queryKeys = {
  // Authentication queries
  auth: {
    session: () => ['auth', 'session'] as const,
    user: () => ['auth', 'user'] as const,
    userRole: (userEmail: string) => ['auth', 'userRole', userEmail] as const,
  },
  
  // User management queries
  users: {
    all: () => ['users'] as const,
    byOrganization: (orgId: string) => ['users', 'organization', orgId] as const,
    byRole: (role: string) => ['users', 'role', role] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  
  // Organization queries
  organizations: {
    all: () => ['organizations'] as const,
    withCounts: () => ['organizations', 'withCounts'] as const,
    detail: (id: string) => ['organizations', 'detail', id] as const,
    settings: (id: string) => ['organizations', 'settings', id] as const,
    name: (userEmail: string) => ['organizations', 'name', userEmail] as const,
  },

  // Manager queries
  managers: {
    all: () => ['managers'] as const,
    withOrganizations: () => ['managers', 'withOrganizations'] as const,
    byOrganization: (orgId: string) => ['managers', 'organization', orgId] as const,
  },

  // Worker queries
  workers: {
    all: () => ['workers'] as const,
    active: () => ['workers', 'active'] as const,
    clockedIn: () => ['workers', 'clockedIn'] as const,
    byOrganization: (orgId: string) => ['workers', 'organization', orgId] as const,
  },

  // Amendment queries
  amendments: {
    all: () => ['amendments'] as const,
    pending: () => ['amendments', 'pending'] as const,
    byWorker: (workerId: string) => ['amendments', 'worker', workerId] as const,
  },
  
  // Time tracking queries
  timeTracking: {
    entries: (filters?: Record<string, any>) => 
      ['timeTracking', 'entries', filters] as const,
    byWorker: (workerId: string, dateRange?: { start: string; end: string }) =>
      ['timeTracking', 'worker', workerId, dateRange] as const,
    reports: (type: string, params?: Record<string, any>) =>
      ['timeTracking', 'reports', type, params] as const,
  },
  
  // Job management queries
  jobs: {
    all: () => ['jobs'] as const,
    active: () => ['jobs', 'active'] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
  },
  
  // Dashboard queries
  dashboard: {
    stats: (orgId: string, dateRange?: { start: string; end: string }) =>
      ['dashboard', 'stats', orgId, dateRange] as const,
    metrics: (type: string) => ['dashboard', 'metrics', type] as const,
  }
};

/**
 * PERFORMANCE: Custom query client with monitoring
 */
class EnhancedQueryClient extends QueryClient {
  private performanceMetrics = {
    queryCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgQueryTime: 0,
    errors: 0
  };
  
  constructor() {
    super({
      defaultOptions: queryConfig
    });
    
    this.setupPerformanceMonitoring();
  }
  
  /**
   * PERFORMANCE: Monitor query performance and cache efficiency
   */
  private setupPerformanceMonitoring(): void {
    // Monitor cache state changes
    this.getQueryCache().subscribe(event => {
      if (event.type === 'added') {
        this.performanceMetrics.queryCount++;
      }
      
      if (event.type === 'updated') {
        const query = event.query;
        
        // Track cache hits/misses
        if (query.state.fetchStatus === 'fetching') {
          this.performanceMetrics.cacheMisses++;
        } else if (query.state.data !== undefined) {
          this.performanceMetrics.cacheHits++;
        }
        
        // Track query timing
        if (query.state.dataUpdatedAt && query.state.dataUpdatedAt > 0) {
          const queryTime = Date.now() - query.state.dataUpdatedAt;
          this.performanceMetrics.avgQueryTime = 
            (this.performanceMetrics.avgQueryTime + queryTime) / 2;
        }
        
        // Track errors
        if (query.state.error) {
          this.performanceMetrics.errors++;
          
          securityMonitor.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'low',
            message: 'Query error detected',
            metadata: {
              queryKey: query.queryKey,
              error: query.state.error
            }
          });
        }
      }
    });
    
    // Periodic performance reporting
    if (!isProduction) {
      setInterval(() => {
        secureLog('Query performance metrics', this.performanceMetrics);
      }, 60000); // Every minute in development
    }
  }
  
  /**
   * PERFORMANCE: Smart cache invalidation
   */
  invalidateQueriesByPattern(pattern: string): Promise<void> {
    const queries = this.getQueryCache().findAll();
    const matchingQueries = queries.filter(query => 
      JSON.stringify(query.queryKey).includes(pattern)
    );
    
    secureLog('Invalidating queries by pattern', { 
      pattern, 
      count: matchingQueries.length 
    });
    
    return this.invalidateQueries({
      predicate: (query) => matchingQueries.includes(query)
    });
  }
  
  /**
   * PERFORMANCE: Prefetch with error handling
   */
  async safePrefetchQuery<T>(
    queryKey: QueryKey,
    queryFn: () => Promise<T>,
    options?: { staleTime?: number }
  ): Promise<void> {
    try {
      await this.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: options?.staleTime || 5 * 60 * 1000,
      });
      
      secureLog('Query prefetched successfully', { queryKey });
    } catch (error) {
      secureError('Query prefetch failed', { queryKey, error });
    }
  }
  
  /**
   * MONITORING: Get performance metrics
   */
  getPerformanceMetrics() {
    const cache = this.getQueryCache();
    const queries = cache.findAll();
    
    return {
      ...this.performanceMetrics,
      totalQueries: queries.length,
      stalestQuery: Math.min(...queries.map(q => q.state.dataUpdatedAt || 0)),
      cacheHitRatio: this.performanceMetrics.cacheHits / 
        (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0,
      errorRate: this.performanceMetrics.errors / this.performanceMetrics.queryCount || 0
    };
  }
  
  /**
   * PERFORMANCE: Optimize cache size
   */
  optimizeCache(): void {
    const cache = this.getQueryCache();
    const queries = cache.findAll();
    
    // Remove unused queries older than 30 minutes
    const cutoff = Date.now() - 30 * 60 * 1000;
    const staleQueries = queries.filter(query => 
      (query.state.dataUpdatedAt || 0) < cutoff && 
      query.getObserversCount() === 0
    );
    
    staleQueries.forEach(query => {
      cache.remove(query);
    });
    
    secureLog('Cache optimized', { 
      removed: staleQueries.length,
      remaining: cache.findAll().length
    });
  }
}

/**
 * PERFORMANCE: Optimized query client instance
 */
export const queryClient = new EnhancedQueryClient();

/**
 * PERFORMANCE: Persistence configuration for offline support
 * Note: Uncomment and configure based on requirements
 */
// import { persistQueryClient } from '@tanstack/react-query-persist-client-core';
// import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// const persister = createSyncStoragePersister({
//   storage: window.localStorage,
//   key: 'REACT_QUERY_OFFLINE_CACHE',
//   serialize: JSON.stringify,
//   deserialize: JSON.parse,
// });

// persistQueryClient({
//   queryClient,
//   persister,
//   maxAge: 1000 * 60 * 60 * 24, // 24 hours
// });

/**
 * PERFORMANCE: Utility hooks for common patterns
 */
export const useInvalidateQueries = () => {
  return {
    // Invalidate all user-related queries
    invalidateUserQueries: () => queryClient.invalidateQueries({ 
      queryKey: queryKeys.users.all() 
    }),
    
    // Invalidate organization queries
    invalidateOrgQueries: (orgId: string) => queryClient.invalidateQueries({ 
      queryKey: queryKeys.organizations.detail(orgId) 
    }),
    
    // Invalidate by pattern
    invalidateByPattern: (pattern: string) => 
      queryClient.invalidateQueriesByPattern(pattern),
    
    // Clear all cache
    clearAll: () => queryClient.clear()
  };
};

/**
 * PERFORMANCE: Background sync for critical data
 */
export const backgroundSync = {
  startSync: () => {
    // Sync critical data every 5 minutes when app is active
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.auth.session() 
        });
      }
    }, 5 * 60 * 1000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(syncInterval);
    });
    
    return () => clearInterval(syncInterval);
  },
  
  syncNow: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() })
    ]);
  }
};