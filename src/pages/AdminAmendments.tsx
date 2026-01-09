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
import { CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';
import moment from 'moment';
import { ExpenseTypesManager } from '@/components/ExpenseTypesManager';
import { OvertimeRequests } from '@/components/OvertimeRequests';
import { formatUKTime } from '@/lib/timezone-utils';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { expenseTypesSteps, timeAmendmentsSteps } from '@/config/onboarding';
import {
  getPageTutorialStatus,
  markPageTutorialComplete,
} from '@/lib/supabase/manager-tutorial';
import { useNavigate } from 'react-router-dom';

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
  source?: 'time_amendments' | 'amendment_requests';
}

export default function AdminAmendments() {
  const navigate = useNavigate();
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showExpenseTour, setShowExpenseTour] = useState(false);
  const [showAmendmentsTour, setShowAmendmentsTour] = useState(false);
  const [showOvertimeTour, setShowOvertimeTour] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  useEffect(() => {
    fetchAmendments();
  }, []);

  // Check if tutorial should run for Expense Types tab
  useEffect(() => {
    const checkTutorial = async () => {
      const hasSeenExpense = await getPageTutorialStatus('amendments');
      if (!hasSeenExpense && activeTab === 'expenses') {
        setTimeout(() => setShowExpenseTour(true), 500);
      }
    };
    checkTutorial();
  }, [activeTab]);

  const handleExpenseTourEnd = async () => {
    setShowExpenseTour(false);
    // Auto-switch to amendments tab after expense tour
    setActiveTab('amendments');
    setTimeout(() => setShowAmendmentsTour(true), 500);
  };

  const handleAmendmentsTourEnd = async () => {
    setShowAmendmentsTour(false);
    // Auto-switch to overtime tab after amendments tour
    setActiveTab('overtime');
    setTimeout(() => setShowOvertimeTour(true), 500);
  };

  const handleOvertimeTourEnd = async () => {
    setShowOvertimeTour(false);
    await markPageTutorialComplete('amendments');
    // Show completion dialog
    setShowCompletionDialog(true);
  };

  const handleTutorialReplay = () => {
    setActiveTab('expenses');
    setTimeout(() => setShowExpenseTour(true), 300);
  };

  const handleFinishTutorial = () => {
    setShowCompletionDialog(false);
  };

  const fetchAmendments = async () => {
    try {
      // Fetch from both time_amendments and amendment_requests tables
      const [legacyResponse, newResponse] = await Promise.all([
        supabase
          .from('time_amendments')
          .select(`
            *,
            workers:worker_id(name, email)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('amendment_requests')
          .select(`
            *,
            workers:worker_id(name, email)
          `)
          .eq('type', 'time_amendment')
          .order('created_at', { ascending: false })
      ]);

      // Transform legacy time_amendments data
      const legacyAmendments: Amendment[] = (legacyResponse.data || []).map(item => ({
        ...item,
        worker: item.workers,
        source: 'time_amendments' as const
      }));

      // Transform new amendment_requests data
      const newAmendments: Amendment[] = (newResponse.data || []).map(item => {
        const payload = item.payload as { clock_in?: string; clock_out?: string } | null;
        return {
          id: item.id,
          clock_entry_id: item.clock_entry_id,
          worker: item.workers,
          requested_clock_in: payload?.clock_in,
          requested_clock_out: payload?.clock_out,
          reason: item.reason || '',
          status: item.status,
          created_at: item.created_at,
          manager_notes: item.manager_notes,
          source: 'amendment_requests' as const
        };
      });

      // Merge and sort by created_at (newest first)
      const allAmendments = [...legacyAmendments, ...newAmendments]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAmendments(allAmendments);
    } catch (error) {
      console.error('Error fetching amendments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (amendmentId: string, status: 'approved' | 'rejected', source: 'time_amendments' | 'amendment_requests' = 'time_amendments') => {
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

      // Step 2: Get full amendment details based on source table
      let amendment: any;
      
      if (source === 'amendment_requests') {
        const { data, error } = await supabase
          .from('amendment_requests')
          .select('*')
          .eq('id', amendmentId)
          .single();
        
        if (error || !data) throw new Error('Amendment not found');
        
        const payload = data.payload as { clock_in?: string; clock_out?: string } | null;
        amendment = {
          ...data,
          requested_clock_in: payload?.clock_in,
          requested_clock_out: payload?.clock_out
        };
      } else {
        const { data, error } = await supabase
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

        if (error || !data) throw new Error('Amendment not found');
        amendment = data;
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

      // Step 3: Update amendment status based on source table
      if (source === 'amendment_requests') {
        const { error: updateError } = await supabase
          .from('amendment_requests')
          .update({
            status,
            manager_notes: managerNotes,
            processed_at: new Date().toISOString(),
            manager_id: manager.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', amendmentId);

        if (updateError) {
          console.error('[AMENDMENT-APPROVAL] Failed to update amendment_requests:', updateError);
          throw new Error(`Failed to ${status} amendment: ${updateError.message}`);
        }
      } else {
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
          console.error('[AMENDMENT-APPROVAL] Failed to update time_amendments:', updateError);
          throw new Error(`Failed to ${status} amendment: ${updateError.message}`);
        }
      }

      console.log('[AMENDMENT-APPROVAL] Amendment updated successfully');

      // Step 4: Verify clock entry was updated (for approved amendments from time_amendments table)
      if (status === 'approved' && source === 'time_amendments') {
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

  const calculateRequestedHours = (clockIn?: string, clockOut?: string): string => {
    if (!clockIn || !clockOut) return '-';
    
    const start = moment(clockIn);
    const end = moment(clockOut);
    const hours = end.diff(start, 'hours', true);
    
    return `${hours.toFixed(2)} hrs`;
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Management</h1>
            <p className="text-muted-foreground">Manage time additions and expense types</p>
          </div>
          <Button
            variant="outline"
            onClick={handleTutorialReplay}
            className="flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Tutorial
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" id="status-filter-tabs">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">Expense Types</TabsTrigger>
            <TabsTrigger id="amendments-tab" value="amendments">Time Additions</TabsTrigger>
            <TabsTrigger id="overtime-tab" value="overtime">Overtime Requests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses" className="space-y-6">
            <ExpenseTypesManager />
          </TabsContent>
          
          <TabsContent value="amendments" className="space-y-6">
            <div className="amendments-table">
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Addition Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {amendments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg font-medium mb-2">
                  No addition requests at this time
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
                    <TableHead>Hours Requested</TableHead>
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
                      <TableCell>
                        <div className="font-medium">
                          {calculateRequestedHours(amendment.requested_clock_in, amendment.requested_clock_out)}
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
                             className="hover:bg-secondary/80 review-amendment-button"
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
           </div>
           </TabsContent>

           <TabsContent value="overtime" className="space-y-6">
             <div className="overtime-requests-section">
               <OvertimeRequests />
             </div>
           </TabsContent>
        </Tabs>

        {selectedAmendment && (
          <Dialog open={true} onOpenChange={() => setSelectedAmendment(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review Addition Request</DialogTitle>
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
                     onClick={() => handleApproval(selectedAmendment.id, 'approved', selectedAmendment.source || 'time_amendments')}
                     className="btn-approve-amendment flex-1 hover:bg-primary/90"
                   >
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Approve
                   </Button>
                   <Button
                     onClick={() => handleApproval(selectedAmendment.id, 'rejected', selectedAmendment.source || 'time_amendments')}
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

      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">🎉 You're all set!</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-center text-muted-foreground">
              You now know how to manage expense types and time additions! If you want a refresher later, just click the "Tutorial" button on this page.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={handleTutorialReplay}
            >
              Replay Tutorial
            </Button>
            <Button onClick={() => setShowCompletionDialog(false)}>
              Explore Additions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Types Tutorial */}
      <OnboardingTour
        steps={expenseTypesSteps}
        run={showExpenseTour}
        onComplete={handleExpenseTourEnd}
        onSkip={handleExpenseTourEnd}
      />

      {/* Time Additions Tutorial */}
      <OnboardingTour
        steps={timeAmendmentsSteps}
        run={showAmendmentsTour}
        onComplete={handleAmendmentsTourEnd}
        onSkip={handleAmendmentsTourEnd}
      />

      {/* Overtime Requests Tutorial */}
      <OnboardingTour
        steps={[
          {
            target: '#overtime-tab',
            content: '⏰ This is the Overtime Requests tab where you manage worker overtime submissions.',
            placement: 'bottom',
          },
          {
            target: '.overtime-requests-section',
            content: '📋 This table displays all overtime requests from the last 14 days with their details.',
            placement: 'top',
          },
          {
            target: 'body',
            content: '✅❌ Approve or Reject overtime requests. Only approved overtime will appear in your reports!',
            placement: 'center',
          },
          {
            target: '#nav-reports-button',
            content: '📊 Next, visit Reports to generate detailed time and expense reports for your team!',
            placement: 'bottom',
          },
        ]}
        run={showOvertimeTour}
        onComplete={handleOvertimeTourEnd}
        onSkip={handleOvertimeTourEnd}
      />
    </Layout>
  );
}