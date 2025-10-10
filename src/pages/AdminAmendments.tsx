import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import moment from 'moment';
import { ExpenseTypesManager } from '@/components/ExpenseTypesManager';
import { formatUKTime } from '@/lib/timezone-utils';

interface Amendment {
  id: string;
  clock_entry_id: string;
  worker: { name: string; email: string };
  requested_clock_in?: string;
  requested_clock_out?: string;
  reason: string;
  status: string;
  created_at: string;
  manager_notes?: string;
  approved_by?: string;
  approved_at?: string;
}

export default function AdminAmendments() {
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAmendments();
  }, []);

  const fetchAmendments = async () => {
    try {
      const { data } = await supabase
        .from('time_amendments')
        .select(`
          *,
          workers:worker_id(name, email)
        `)
        .order('created_at', { ascending: false });

      const transformedData = (data || []).map(item => ({
        ...item,
        worker: item.workers
      }));
      setAmendments(transformedData);
    } catch (error) {
      console.error('Error fetching amendments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (amendmentId: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Error',
        description: 'Not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Step 1: Get manager details
      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('id, name, email')
        .eq('email', user.email)
        .single();

      if (managerError || !manager) {
        throw new Error('Manager not found');
      }

      // Step 2: Get full amendment details including clock entry info
      const { data: amendment, error: amendmentFetchError } = await supabase
        .from('time_amendments')
        .select(`
          *,
          clock_entries:clock_entry_id(
            id,
            clock_in,
            clock_out,
            total_hours,
            worker_id
          )
        `)
        .eq('id', amendmentId)
        .single();

      if (amendmentFetchError || !amendment) {
        throw new Error('Amendment not found');
      }

      console.log('[AMENDMENT-APPROVAL] Processing amendment:', {
        amendmentId,
        status,
        workerId: amendment.worker_id,
        currentClockIn: amendment.clock_entries?.clock_in,
        requestedClockIn: amendment.requested_clock_in,
        currentClockOut: amendment.clock_entries?.clock_out,
        requestedClockOut: amendment.requested_clock_out
      });

      // Step 3: Update amendment status
      // The database trigger will automatically update clock_entries if status='approved'
      const { error: updateError } = await supabase
        .from('time_amendments')
        .update({
          status,
          manager_notes: managerNotes,
          processed_at: new Date().toISOString(),
          approved_by: manager.name,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          manager_id: manager.id
        })
        .eq('id', amendmentId);

      if (updateError) {
        console.error('[AMENDMENT-APPROVAL] Failed to update amendment:', updateError);
        throw new Error(`Failed to ${status} amendment: ${updateError.message}`);
      }

      console.log('[AMENDMENT-APPROVAL] Amendment updated successfully');

      // Step 4: Verify clock entry was updated (for approved amendments)
      if (status === 'approved') {
        const { data: updatedClockEntry, error: verifyError } = await supabase
          .from('clock_entries')
          .select('clock_in, clock_out, total_hours')
          .eq('id', amendment.clock_entry_id)
          .single();

        if (verifyError) {
          console.error('[AMENDMENT-APPROVAL] Failed to verify clock entry update:', verifyError);
          // Rollback amendment approval
          await supabase
            .from('time_amendments')
            .update({ 
              status: 'pending',
              processed_at: null,
              approved_by: null,
              approved_at: null
            })
            .eq('id', amendmentId);
          
          throw new Error('Clock entry update failed - amendment reverted to pending');
        }

        console.log('[AMENDMENT-APPROVAL] Clock entry verified:', updatedClockEntry);
      }

      // Step 5: Send notification (non-blocking)
      supabase.functions.invoke('send-amendment-notification', {
        body: {
          worker_id: amendment.worker_id,
          amendment_id: amendmentId,
          status,
          manager_name: manager.name,
          requested_clock_in: amendment.requested_clock_in,
          requested_clock_out: amendment.requested_clock_out,
          manager_notes: managerNotes
        }
      }).then(({ error: notifError }) => {
        if (notifError) {
          console.error('[AMENDMENT-APPROVAL] Notification failed:', notifError);
        } else {
          console.log('[AMENDMENT-APPROVAL] Notification sent');
        }
      });

      // Step 6: Show success message
      toast({
        title: `Amendment ${status}`,
        description: status === 'approved' 
          ? 'Time amendment approved and clock entry updated. Worker has been notified.'
          : 'Time amendment rejected. Worker has been notified.',
      });

      // Step 7: Close dialog and refresh
      setSelectedAmendment(null);
      setManagerNotes('');
      fetchAmendments();

    } catch (error) {
      console.error('[AMENDMENT-APPROVAL] Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process amendment.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Management</h1>
          <p className="text-muted-foreground">Manage time amendments and expense types</p>
        </div>

        <Tabs defaultValue="expenses" className="w-full" id="status-filter-tabs">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expenses">Expense Types</TabsTrigger>
            <TabsTrigger id="amendments-tab" value="amendments">Time Amendments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses" className="space-y-6">
            <ExpenseTypesManager />
          </TabsContent>
          
          <TabsContent value="amendments" className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Amendment Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {amendments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg font-medium mb-2">
                  No amendment requests at this time
                </p>
                <p className="text-sm text-muted-foreground">
                  Worker time change requests will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amendments.map((amendment) => (
                    <TableRow key={amendment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{amendment.worker?.name}</div>
                          <div className="text-sm text-muted-foreground">{amendment.worker?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Submitted: {formatUKTime(amendment.created_at)}</div>
                          {amendment.requested_clock_in && (
                            <div>In: {formatUKTime(amendment.requested_clock_in)}</div>
                          )}
                          {amendment.requested_clock_out && (
                            <div>Out: {formatUKTime(amendment.requested_clock_out)}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{amendment.reason}</p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(amendment.status)}
                        {amendment.status === 'approved' && amendment.approved_by && (
                          <span className="text-xs text-[#939393] font-body block">
                            Approved by: {amendment.approved_by}
                          </span>
                        )}
                      </TableCell>
                       <TableCell>
                         {amendment.status === 'pending' && (
                           <Button
                             size="sm"
                             variant="outline"
                             className="hover:bg-secondary/80"
                             onClick={() => setSelectedAmendment(amendment)}
                           >
                             Review
                           </Button>
                         )}
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          </Card>
          </TabsContent>
        </Tabs>

        {selectedAmendment && (
          <Dialog open={true} onOpenChange={() => setSelectedAmendment(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review Amendment Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Worker: {selectedAmendment.worker?.name}</h4>
                  <p className="text-sm text-muted-foreground">Reason: {selectedAmendment.reason}</p>
                </div>
                <Textarea
                  placeholder="Manager notes (optional)"
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
                 <div className="flex space-x-2">
                   <Button
                     onClick={() => handleApproval(selectedAmendment.id, 'approved')}
                     className="btn-approve-amendment flex-1 hover:bg-primary/90"
                   >
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Approve
                   </Button>
                   <Button
                     onClick={() => handleApproval(selectedAmendment.id, 'rejected')}
                     variant="destructive"
                     className="btn-reject-amendment flex-1 hover:bg-destructive/90"
                   >
                     <XCircle className="h-4 w-4 mr-2" />
                     Reject
                   </Button>
                 </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}