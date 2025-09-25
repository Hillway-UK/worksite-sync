/**
 * SECURITY & PERFORMANCE: Main Application Entry Point
 * Implements security monitoring and performance optimizations
 */

import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './index.css'

// SECURITY & PERFORMANCE: Import optimized clients
import { queryClient, backgroundSync } from '@/lib/query-client'
import { securityMonitor } from '@/lib/security-middleware'
import { secureLog, secureError } from '@/lib/validation'
import { isDevelopment } from '@/lib/environment'

/**
 * SECURITY: Global error handling
 * Captures and logs unhandled errors securely
 */
window.addEventListener('error', (event) => {
  securityMonitor.logSecurityEvent({
    type: 'suspicious_activity',
    severity: 'medium',
    message: 'Unhandled JavaScript error',
    metadata: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  securityMonitor.logSecurityEvent({
    type: 'suspicious_activity',
    severity: 'medium',
    message: 'Unhandled promise rejection',
    metadata: {
      reason: event.reason
    }
  });
});

/**
 * PERFORMANCE: Initialize background synchronization
 */
backgroundSync.startSync();

/**
 * SECURITY: Log application startup
 */
secureLog('Application starting', {
  timestamp: new Date().toISOString(),
  environment: isDevelopment ? 'development' : 'production',
  userAgent: navigator.userAgent.substring(0, 100) // Limit to prevent log pollution
});

/**
 * PERFORMANCE: Enhanced App wrapper with React Query
 */
const EnhancedApp = () => (
  <QueryClientProvider client={queryClient}>
    <App />
    {isDevelopment && (
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom"
      />
    )}
  </QueryClientProvider>
);

// SECURITY: Validate root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  secureError('Root element not found');
  throw new Error('Failed to find root element');
}

createRoot(rootElement).render(<EnhancedApp />);
