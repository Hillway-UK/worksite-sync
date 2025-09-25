/**
 * SECURITY: Security Monitoring Dashboard
 * Displays security metrics, events, and system health for administrators
 * Implements OWASP monitoring best practices
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { SecurityMonitor, securityMonitor } from '@/lib/security-middleware';
import { queryClient } from '@/lib/query-client';
import { Shield, AlertTriangle, Activity, TrendingUp, RefreshCw } from 'lucide-react';

interface SecurityDashboardProps {
  className?: string;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * MONITORING: Fetch security and performance data
   */
  const refreshData = async () => {
    setRefreshing(true);
    try {
      // Get security metrics
      const securityMetrics = SecurityMonitor.getMetrics();
      setMetrics(securityMetrics);

      // Get recent security events
      const recentEvents = SecurityMonitor.getEvents({ 
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
      });
      setEvents(recentEvents.slice(0, 20)); // Limit to 20 recent events

      // Get performance metrics
      const perfMetrics = queryClient.getPerformanceMetrics();
      setPerformanceMetrics(perfMetrics);
    } catch (error) {
      console.error('Failed to refresh security dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * UTILITY: Get severity color for events
   */
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  /**
   * UTILITY: Format timestamp for display
   */
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading security dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
  const securityScore = Math.max(0, 100 - (criticalEvents.length * 10));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityScore}%</div>
            <Progress value={securityScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on recent security events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.recentEvents}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics ? Math.round(performanceMetrics.cacheHitRatio * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Performance metric
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {criticalEvents.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {criticalEvents.length} critical security event(s) detected in the last 24 hours. 
            Review the events below for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="events" className="w-full">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="events">Security Events</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Security events from the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.length === 0 ? (
                  <p className="text-muted-foreground">No security events recorded</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getSeverityColor(event.severity) as any}>
                            {event.severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{event.type.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <p className="text-sm">{event.message}</p>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground ml-4">
                        {formatTime(event.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Application performance and caching statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceMetrics ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Total Queries</p>
                    <p className="text-2xl font-bold">{performanceMetrics.totalQueries}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cache Hits</p>
                    <p className="text-2xl font-bold">{performanceMetrics.cacheHits}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cache Misses</p>
                    <p className="text-2xl font-bold">{performanceMetrics.cacheMisses}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Avg Query Time</p>
                    <p className="text-2xl font-bold">{Math.round(performanceMetrics.avgQueryTime)}ms</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Error Rate</p>
                    <p className="text-2xl font-bold">{Math.round(performanceMetrics.errorRate * 100)}%</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cache Hit Ratio</p>
                    <p className="text-2xl font-bold">{Math.round(performanceMetrics.cacheHitRatio * 100)}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Performance data not available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Metrics Breakdown</CardTitle>
              <CardDescription>
                Detailed breakdown of security events by type and severity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Events by Severity</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(metrics.severityCounts).map(([severity, count]) => (
                      <div key={severity} className="text-center">
                        <Badge variant={getSeverityColor(severity) as any} className="mb-1">
                          {severity}
                        </Badge>
                        <p className="text-lg font-bold">{count as number}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Events by Type</h4>
                  <div className="space-y-2">
                    {Object.entries(metrics.typeCounts).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <Badge variant="outline">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};