import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface OvertimeRequest {
  id: string;
  worker_id: string;
  worker_name: string;
  job_name: string;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
  ot_status: string;
  ot_requested_at: string;
  ot_approved_by: string | null;
  ot_approved_reason: string | null;
}

interface OvertimeDecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: OvertimeRequest | null;
  decision: 'approve' | 'reject';
  onSuccess: () => void;
}

export function OvertimeDecisionModal({
  open,
  onOpenChange,
  entry,
  decision,
  onSuccess,
}: OvertimeDecisionModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!entry || !reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for your decision.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current manager ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: managerData } = await supabase
        .from('managers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!managerData) throw new Error('Manager not found');

      // Update clock entry with decision
      const { error: updateError } = await supabase
        .from('clock_entries')
        .update({
          ot_status: decision === 'approve' ? 'approved' : 'rejected',
          ot_approved_by: managerData.id,
          ot_approved_reason: reason,
          ot_approved_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;

      // Send notification to worker
      const notificationBody = decision === 'approve'
        ? `Your overtime request for ${format(new Date(entry.clock_in), 'MMM dd, yyyy')} (${entry.hours?.toFixed(1) || '0'} hrs) has been approved.`
        : `Your overtime request for ${format(new Date(entry.clock_in), 'MMM dd, yyyy')} was rejected. Reason: ${reason}`;

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          worker_id: entry.worker_id,
          type: decision === 'approve' ? 'overtime_approved' : 'overtime_rejected',
          title: decision === 'approve' ? 'Overtime Approved' : 'Overtime Rejected',
          body: notificationBody,
          created_at: new Date().toISOString(),
        });

      if (notificationError) throw notificationError;

      toast({
        title: decision === 'approve' ? 'Overtime Approved' : 'Overtime Rejected',
        description: `Decision sent to ${entry.worker_name}`,
      });

      setReason('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error processing overtime decision:', error);
      toast({
        title: 'Error',
        description: 'Failed to process overtime decision. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {decision === 'approve' ? 'Approve' : 'Reject'} Overtime Request
          </DialogTitle>
          <DialogDescription>
            {entry && (
              <>
                <div className="mt-2 space-y-1">
                  <p><strong>Worker:</strong> {entry.worker_name}</p>
                  <p><strong>Job:</strong> {entry.job_name}</p>
                  <p><strong>Date:</strong> {format(new Date(entry.clock_in), 'MMM dd, yyyy')}</p>
                  <p><strong>Hours:</strong> {entry.hours !== null ? `${entry.hours.toFixed(1)} hrs` : 'In Progress'}</p>
                </div>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder={`Enter reason for ${decision === 'approve' ? 'approval' : 'rejection'}...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason('');
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            variant={decision === 'approve' ? 'default' : 'destructive'}
          >
            {isSubmitting ? 'Processing...' : decision === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
