import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface AutoClockoutActivity {
  id: string;
  worker_id: string;
  shift_date: string;
  performed: boolean;
  reason: string;
  decided_at: string;
  notes: string | null;
  worker_name: string;
  organization_id: string;
  clock_out_time: string | null;
}

interface RecentActivityCardProps {
  maxItems?: number;
  maxHeight?: string;
}

const reasonLabels: Record<string, string> = {
  CAP_MONTH: 'max session reached',
  CAP_ROLLING14: 'max session reached',
  CONSECUTIVE_BLOCK: 'shift ended',
  NO_SHIFT: 'shift ended',
  NO_CLOCK_IN: 'inactivity threshold',
  ALREADY_CLOCKED_OUT: 'system rule',
  UNKNOWN: 'system rule',
  OK: 'system rule',
};

export function RecentActivityCard({ 
  maxItems = 20,
  maxHeight = '24rem' 
}: RecentActivityCardProps) {
  const [activities, setActivities] = useState<AutoClockoutActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: manager } = await supabase
          .from('managers')
          .select('organization_id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (manager?.organization_id) {
          setOrgId(manager.organization_id);
        }
      }
    };
    fetchOrgId();
  }, []);

  const fetchActivities = async () => {
    if (!orgId) return;
    
    try {
      const { data, error } = await supabase
        .from('auto_clockout_audit')
        .select(`
          id,
          worker_id,
          shift_date,
          performed,
          reason,
          decided_at,
          notes,
          workers!inner(name, organization_id)
        `)
        .eq('workers.organization_id', orgId)
        .eq('performed', true)
        .order('decided_at', { ascending: false })
        .limit(maxItems);

      if (error) throw error;

      // Fetch clock_out times for each entry
      const activitiesWithClockOut = await Promise.all(
        (data || []).map(async (activity: any) => {
          const { data: clockEntry } = await supabase
            .from('clock_entries')
            .select('clock_out')
            .eq('worker_id', activity.worker_id)
            .gte('clock_in', `${activity.shift_date}T00:00:00`)
            .lte('clock_in', `${activity.shift_date}T23:59:59`)
            .eq('auto_clocked_out', true)
            .order('clock_out', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: activity.id,
            worker_id: activity.worker_id,
            shift_date: activity.shift_date,
            performed: activity.performed,
            reason: activity.reason,
            decided_at: activity.decided_at,
            notes: activity.notes,
            worker_name: activity.workers.name,
            organization_id: activity.workers.organization_id,
            clock_out_time: clockEntry?.clock_out || activity.decided_at,
          };
        })
      );

      setActivities(activitiesWithClockOut);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    
    fetchActivities();

    // Setup realtime subscription
    const channel = supabase
      .channel('auto_clockout_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_clockout_audit',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, maxItems]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatRelativeTime = (timestamp: string): string => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-4 w-4 mt-1" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No auto-clockouts yet.</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {activity.worker_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reasonLabels[activity.reason] || reasonLabels.UNKNOWN}
                      {' • '}
                      {formatTime(activity.clock_out_time || activity.decided_at)}
                      {' • '}
                      <span className="text-[11px]">
                        {formatRelativeTime(activity.clock_out_time || activity.decided_at)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
