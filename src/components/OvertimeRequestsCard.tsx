import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { OvertimeDecisionModal } from './OvertimeDecisionModal';

interface OvertimeRequest {
  id: string;
  worker_id: string;
  worker_name: string;
  job_name: string;
  clock_in: string;
  clock_out: string;
  hours: number;
  ot_status: string;
  ot_requested_at: string;
  ot_approved_by: string | null;
  ot_approved_reason: string | null;
}

export function OvertimeRequestsCard() {
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<OvertimeRequest | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchOvertimeRequests = async () => {
    try {
      const { data, error } = await supabase.rpc('get_overtime_requests');

      if (error) throw error;

      setOvertimeRequests(data || []);
    } catch (error) {
      console.error('Error fetching overtime requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOvertimeRequests();

    // Set up real-time subscription for overtime changes
    const channel = supabase
      .channel('overtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_entries',
          filter: 'is_overtime=eq.true',
        },
        () => {
          fetchOvertimeRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openModal = (decisionType: 'approve' | 'reject', entry: OvertimeRequest) => {
    setSelectedEntry(entry);
    setDecision(decisionType);
    setModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Requests (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Requests (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overtimeRequests.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No overtime requests in the last 14 days</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overtimeRequests.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{entry.worker_name}</TableCell>
                      <TableCell>{entry.job_name}</TableCell>
                      <TableCell>{format(new Date(entry.clock_in), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(entry.clock_in), 'HH:mm')}</TableCell>
                      <TableCell>{format(new Date(entry.clock_out), 'HH:mm')}</TableCell>
                      <TableCell>{entry.hours.toFixed(1)}</TableCell>
                      <TableCell>{getStatusBadge(entry.ot_status)}</TableCell>
                      <TableCell>
                        {entry.ot_status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openModal('approve', entry)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openModal('reject', entry)}
                            >
                              Reject
                            </Button>
                          </div>
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

      {decision && (
        <OvertimeDecisionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          entry={selectedEntry}
          decision={decision}
          onSuccess={() => {
            fetchOvertimeRequests();
            setSelectedEntry(null);
            setDecision(null);
          }}
        />
      )}
    </>
  );
}
