import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface AutoClockoutActivity {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_email: string;
  job_name: string | null;
  shift_date: string;
  performed: boolean;
  reason: string;
  decided_at: string;
  notes: string | null;
  organization_id: string;
  clock_out_time: string | null;
}

interface RecentActivityCardProps {
  maxHeight?: string;
}

const reasonLabels: Record<string, string> = {
  CAP_MONTH: "max session reached",
  CAP_ROLLING14: "max session reached",
  CONSECUTIVE_BLOCK: "shift ended",
  NO_SHIFT: "shift ended",
  NO_CLOCK_IN: "inactivity threshold",
  ALREADY_CLOCKED_OUT: "system rule",
  UNKNOWN: "system rule",
  OK: "system rule",
  SYSTEM_AUTO: "auto clocked out",
};

export function RecentActivityCard({ maxHeight = "24rem" }: RecentActivityCardProps) {
  const [activities, setActivities] = useState<AutoClockoutActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: manager } = await supabase
          .from("managers")
          .select("organization_id")
          .eq("email", user.email)
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
      // Calculate 14 days ago
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Fetch clock entries where source = 'system_auto' (auto-clocked out workers)
      // and clock_out is within the last 14 days
      const { data: clockEntries, error } = await supabase
        .from("clock_entries")
        .select(`
          id,
          worker_id,
          clock_in,
          clock_out,
          job_id,
          notes,
          workers!inner(name, email, organization_id),
          jobs(name)
        `)
        .eq("source", "system_auto")
        .eq("workers.organization_id", orgId)
        .gte("clock_out", fourteenDaysAgo.toISOString())
        .not("clock_out", "is", null)
        .order("clock_out", { ascending: false });

      if (error) throw error;

      if (!clockEntries || clockEntries.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Map to activity format
      const activitiesWithDetails = clockEntries.map((entry: any) => ({
        id: entry.id,
        worker_id: entry.worker_id,
        worker_name: entry.workers.name,
        worker_email: entry.workers.email,
        job_name: entry.jobs?.name || null,
        shift_date: entry.clock_in.split('T')[0],
        performed: true,
        reason: entry.notes || 'Auto clocked out',
        decided_at: entry.clock_out,
        notes: entry.notes,
        organization_id: entry.workers.organization_id,
        clock_out_time: entry.clock_out,
      }));

      setActivities(activitiesWithDetails);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;

    fetchActivities();

    // Setup realtime subscription for clock_entries
    const channel = supabase
      .channel("clock_entries_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clock_entries",
        },
        () => {
          fetchActivities();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const formatDateTime = (timestamp: string): string => {
    try {
      return format(new Date(timestamp), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Worker Email</TableHead>
                <TableHead>Jobsite</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity (Last 14 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No auto-clockout activities in the last 14 days.</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker Name</TableHead>
                  <TableHead>Worker Email</TableHead>
                  <TableHead>Jobsite</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.worker_name}</TableCell>
                    <TableCell>{activity.worker_email}</TableCell>
                    <TableCell>{activity.job_name || 'N/A'}</TableCell>
                    <TableCell>{activity.reason}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(activity.clock_out_time || activity.decided_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
