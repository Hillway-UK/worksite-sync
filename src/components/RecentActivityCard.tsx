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
  shift_date: string;
  performed: boolean;
  reason: string;
  decided_at: string;
  notes: string | null;
  worker_name: string;
  worker_email: string;
  organization_id: string;
  clock_out_time: string | null;
  job_name: string | null;
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
      // Calculate date 7 days ago for rolling window
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("auto_clockout_audit")
        .select(
          `
          id,
          worker_id,
          shift_date,
          performed,
          reason,
          decided_at,
          notes,
          workers!inner(name, email, organization_id)
        `,
        )
        .eq("workers.organization_id", orgId)
        .eq("performed", true)
        .gte("decided_at", sevenDaysAgo.toISOString())
        .order("decided_at", { ascending: false });

      if (error) throw error;

      // Fetch clock_out times and job names for each entry
      const activitiesWithDetails = await Promise.all(
        (data || []).map(async (activity: any) => {
          // Get clock entry with job information
          const { data: clockEntry } = await supabase
            .from("clock_entries")
            .select("clock_out, job_id, jobs(name)")
            .eq("worker_id", activity.worker_id)
            .gte("clock_in", `${activity.shift_date}T00:00:00`)
            .lte("clock_in", `${activity.shift_date}T23:59:59`)
            .eq("auto_clocked_out", true)
            .order("clock_out", { ascending: false })
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
            worker_email: activity.workers.email,
            organization_id: activity.workers.organization_id,
            clock_out_time: clockEntry?.clock_out || activity.decided_at,
            job_name: clockEntry?.jobs?.name || null,
          };
        }),
      );

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

    // Setup realtime subscription
    const channel = supabase
      .channel("auto_clockout_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auto_clockout_audit",
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
      return format(new Date(timestamp), "EEE, dd MMM yyyy, h:mm a");
    } catch {
      return "N/A";
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
        <CardTitle>Recent Activity (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No auto-clockout activities in the past 7 days.</p>
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
                  <TableHead>Date & Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.worker_name}</TableCell>
                    <TableCell>{activity.worker_email}</TableCell>
                    <TableCell>{activity.job_name || "N/A"}</TableCell>
                    <TableCell>{reasonLabels[activity.reason] || reasonLabels.UNKNOWN}</TableCell>
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
