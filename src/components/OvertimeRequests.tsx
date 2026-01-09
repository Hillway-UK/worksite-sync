import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { formatUKTimeOnly } from "@/lib/timezone-utils";

interface OvertimeRequest {
  id: string;
  worker_id: string;
  worker: string;
  site: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
  ot_status: "pending" | "approved" | "rejected";
  source: "clock_entries" | "amendment_requests";
}

interface ApprovalModalData {
  entry: OvertimeRequest;
  action: "approve" | "reject";
}

export function OvertimeRequests() {
  const [otRequests, setOtRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<ApprovalModalData | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOvertimeRequests();
  }, []);

  const fetchOvertimeRequests = async () => {
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch from both clock_entries and amendment_requests tables
      // @ts-ignore - Complex Supabase type inference
      const [clockEntriesResponse, amendmentRequestsResponse] = await Promise.all([
        supabase
          .from("clock_entries")
          .select("id, worker_id, clock_in, clock_out, ot_status, job_id, total_hours")
          .eq("is_overtime", true)
          .gte("clock_in", fourteenDaysAgo),
        supabase
          .from("amendment_requests")
          .select("*, workers:worker_id(name)")
          .eq("type", "overtime_request")
          .gte("created_at", fourteenDaysAgo)
      ]);

      const { data: clockEntries, error: clockError } = clockEntriesResponse as { data: any[] | null; error: any };
      const { data: amendmentRequests, error: amendmentError } = amendmentRequestsResponse;

      console.log("OT Requests Debug - clockEntries:", clockEntries?.length, "amendmentRequests:", amendmentRequests?.length, amendmentRequests);

      if (clockError) throw clockError;
      if (amendmentError) throw amendmentError;

      // Collect worker/job IDs from clock_entries
      const workerIds = [...new Set((clockEntries || []).map((e) => e.worker_id))];
      const jobIds = [...new Set((clockEntries || []).map((e) => e.job_id).filter(Boolean))];

      // Also collect worker IDs from amendment_requests that aren't already in the list
      (amendmentRequests || []).forEach((req) => {
        if (!workerIds.includes(req.worker_id)) {
          workerIds.push(req.worker_id);
        }
      });

      const [workersResponse, jobsResponse] = await Promise.all([
        workerIds.length > 0 ? supabase.from("workers").select("id, name").in("id", workerIds) : { data: [] as { id: string; name: string }[] },
        jobIds.length > 0 ? supabase.from("jobs").select("id, name").in("id", jobIds) : { data: [] as { id: string; name: string }[] },
      ]);

      const workerMap = new Map<string, string>(
        (workersResponse.data || []).map((w: { id: string; name: string }) => [w.id, w.name])
      );
      const jobMap = new Map<string, string>(
        (jobsResponse.data || []).map((j: { id: string; name: string }) => [j.id, j.name])
      );

      // Format clock_entries data
      const legacyOT: OvertimeRequest[] = (clockEntries || []).map((entry) => ({
        id: entry.id,
        worker_id: entry.worker_id,
        worker: workerMap.get(entry.worker_id) || "Unknown Worker",
        site: jobMap.get(entry.job_id) || "Unknown Site",
        started_at: entry.clock_in,
        ended_at: entry.clock_out || null,
        hours: entry.total_hours || null,
        ot_status: entry.ot_status || "pending",
        source: "clock_entries" as const,
      }));

      // Format amendment_requests data
      const newOT: OvertimeRequest[] = (amendmentRequests || []).map((req) => {
        const payload = req.payload as { 
          hours?: number; 
          clock_in?: string; 
          clock_out?: string; 
          ot_start_time?: string;
          ot_end_time?: string;
          job_name?: string;
        } | null;
        return {
          id: req.id,
          worker_id: req.worker_id,
          worker: (req.workers as { name?: string } | null)?.name || workerMap.get(req.worker_id) || "Unknown Worker",
          site: payload?.job_name || "Unknown Site",
          started_at: payload?.ot_start_time || payload?.clock_in || req.created_at,
          ended_at: payload?.ot_end_time || payload?.clock_out || null,
          hours: payload?.hours || null,
          ot_status: req.status as "pending" | "approved" | "rejected",
          source: "amendment_requests" as const,
        };
      });

      // Merge both sources
      const allOT = [...legacyOT, ...newOT];

      // Remove duplicates based on unique ID to preserve all distinct records
      const uniqueData = allOT.filter(
        (entry, index, self) =>
          index === self.findIndex((e) => e.id === entry.id),
      );

      // Sort: pending first, then oldest first
      uniqueData.sort((a, b) => {
        if (a.ot_status === "pending" && b.ot_status !== "pending") return -1;
        if (a.ot_status !== "pending" && b.ot_status === "pending") return 1;
        return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      });

      setOtRequests(uniqueData);
    } catch (error) {
      console.error("Error fetching overtime requests:", error);
      toast({
        title: "Error",
        description: "Failed to load overtime requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!modalData) {
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: manager } = await supabase.from("managers").select("id").eq("email", user.email).single();

      if (!manager) throw new Error("Manager not found");

      const approved = modalData.action === "approve";

      // Update based on source table
      if (modalData.entry.source === "amendment_requests") {
        const { error: updateError } = await supabase
          .from("amendment_requests")
          .update({
            status: approved ? "approved" : "rejected",
            manager_notes: reason,
            manager_id: manager.id,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", modalData.entry.id);

        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from("clock_entries")
          .update({
            ot_status: approved ? "approved" : "rejected",
            approved_by: manager.id,
            approved_reason: reason,
            approved_at: new Date().toISOString(),
          })
          .eq("id", modalData.entry.id);

        if (updateError) throw updateError;
      }

      const notificationMessage = approved
        ? `Your overtime request for ${format(new Date(modalData.entry.started_at), "MMM d, yyyy")} (${modalData.entry.hours ?? "?"} hrs) has been approved.`
        : `Your overtime request was rejected. Reason: ${reason}`;

      const { error: notificationError } = await supabase.from("notifications").insert({
        worker_id: modalData.entry.worker_id,
        type: approved ? "overtime_approved" : "overtime_rejected",
        title: approved ? "Overtime Approved" : "Overtime Rejected",
        body: notificationMessage,
      });

      if (notificationError) {
        console.error("Failed to send notification:", notificationError);
      }

      toast({
        title: "Success",
        description: `Overtime request ${approved ? "approved" : "rejected"}`,
      });

      await fetchOvertimeRequests();
      setModalData(null);
      setReason("");
    } catch (error) {
      console.error("Error processing overtime decision:", error);
      toast({
        title: "Error",
        description: "Failed to process overtime request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 overtime-requests-table">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Requests (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground text-lg font-medium">
                Loading overtime requests...
              </p>
            </div>
          ) : otRequests.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg font-medium mb-2">
                No overtime requests at this time
              </p>
              <p className="text-sm text-muted-foreground">
                Worker overtime requests from the last 14 days will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otRequests.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.worker}</TableCell>
                      <TableCell>{entry.site}</TableCell>
                      <TableCell>{format(new Date(entry.started_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{formatUKTimeOnly(entry.started_at)}</TableCell>
                      <TableCell>{entry.ended_at ? formatUKTimeOnly(entry.ended_at) : "-"}</TableCell>
                      <TableCell>{entry.hours !== null ? entry.hours.toFixed(1) : "-"}</TableCell>
                      <TableCell>{getStatusBadge(entry.ot_status)}</TableCell>
                      <TableCell>
                        {entry.ot_status === "pending" && (entry.source === "amendment_requests" || entry.ended_at) && (
                          <TooltipProvider>
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => setModalData({ entry, action: "approve" })}
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Approve</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => setModalData({ entry, action: "reject" })}
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reject</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval/Rejection Modal */}
      <Dialog open={!!modalData} onOpenChange={() => setModalData(null)}>
        <DialogContent>
          {modalData && (
            <>
              <DialogHeader>
                <DialogTitle>{modalData.action === "approve" ? "Approve" : "Reject"} Overtime Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Worker:</strong> {modalData.entry.worker}
                  </p>
                  <p className="text-sm">
                    <strong>Date:</strong> {format(new Date(modalData.entry.started_at), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm">
                    <strong>Hours:</strong>{" "}
                    {modalData.entry.hours !== null ? modalData.entry.hours.toFixed(1) : "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Notes (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter notes for decision..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalData(null);
                    setReason("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDecision}
                  disabled={submitting}
                  variant={modalData.action === "approve" ? "default" : "destructive"}
                >
                  {submitting ? "Processing..." : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
