import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Clock, Edit, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import moment from 'moment';

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
  job?: {
    name: string;
    code: string;
  };
}

interface Amendment {
  id: string;
  clock_entry_id: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  reason: string;
  status: string;
  created_at: string;
  manager_notes?: string;
}

export default function Amendments() {
  const { user } = useAuth();
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ClockEntry | null>(null);
  const [requestedClockIn, setRequestedClockIn] = useState('');
  const [requestedClockOut, setRequestedClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [workerId, setWorkerId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user?.email) return;

    try {
      // Get worker data with both clock entries and amendments in parallel
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!worker) return;

      setWorkerId(worker.id);

      const [entriesResult, amendmentResult] = await Promise.all([
        supabase
          .from('clock_entries')
          .select(`
            *,
            jobs:job_id(name, code)
          `)
          .eq('worker_id', worker.id)
          .order('clock_in', { ascending: false })
          .limit(50),
        supabase
          .from('time_amendments')
          .select('*')
          .eq('worker_id', worker.id)
          .order('created_at', { ascending: false })
      ]);

      setClockEntries(entriesResult.data || []);
      setAmendments(amendmentResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAmendment = async () => {
    if (!selectedEntry || !user?.email || !workerId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('time_amendments')
        .insert({
          clock_entry_id: selectedEntry.id,
          worker_id: workerId,
          requested_clock_in: requestedClockIn || null,
          requested_clock_out: requestedClockOut || null,
          reason
        });

      if (error) throw error;

      toast({
        title: 'Amendment Requested',
        description: 'Your time amendment request has been submitted for approval.',
      });

      setIsModalOpen(false);
      setSelectedEntry(null);
      setRequestedClockIn('');
      setRequestedClockOut('');
      setReason('');
      fetchData();
    } catch (error) {
      console.error('Error submitting amendment:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit amendment request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openAmendmentModal = (entry: ClockEntry) => {
    setSelectedEntry(entry);
    setRequestedClockIn(moment(entry.clock_in).format('YYYY-MM-DDTHH:mm'));
    setRequestedClockOut(entry.clock_out ? moment(entry.clock_out).format('YYYY-MM-DDTHH:mm') : '');
    setReason('');
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading amendments...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Time Amendments</h1>
          <p className="text-muted-foreground">Request changes to your clock entries</p>
        </div>

        {/* Pending Amendments */}
        {amendments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Amendment Requests</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {amendments.map((amendment) => (
                  <div key={amendment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Amendment Request</p>
                      <p className="text-sm text-muted-foreground">{amendment.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {moment(amendment.created_at).format('MMM D, YYYY h:mm A')}
                      </p>
                      {amendment.manager_notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <strong>Manager Notes:</strong> {amendment.manager_notes}
                        </p>
                      )}
                    </div>
                    <div>
                      {getStatusBadge(amendment.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clock Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Clock Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clockEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {moment(entry.clock_in).format('MMM D, YYYY')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.job?.name}</div>
                        <div className="text-sm text-muted-foreground">{entry.job?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {moment(entry.clock_in).format('h:mm A')}
                    </TableCell>
                    <TableCell>
                      {entry.clock_out ? moment(entry.clock_out).format('h:mm A') : 'In Progress'}
                    </TableCell>
                    <TableCell>
                      {entry.total_hours?.toFixed(2) || 'In Progress'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAmendmentModal(entry)}
                        disabled={!entry.clock_out}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Request Change
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Amendment Request Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Time Amendment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEntry && (
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-semibold">Current Entry</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedEntry.job?.name} - {moment(selectedEntry.clock_in).format('MMM D, YYYY')}
                  </p>
                  <p className="text-sm">
                    {moment(selectedEntry.clock_in).format('h:mm A')} - {' '}
                    {selectedEntry.clock_out ? moment(selectedEntry.clock_out).format('h:mm A') : 'In Progress'}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="requested_clock_in">Requested Clock In Time</Label>
                <Input
                  id="requested_clock_in"
                  type="datetime-local"
                  value={requestedClockIn}
                  onChange={(e) => setRequestedClockIn(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="requested_clock_out">Requested Clock Out Time</Label>
                <Input
                  id="requested_clock_out"
                  type="datetime-local"
                  value={requestedClockOut}
                  onChange={(e) => setRequestedClockOut(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="reason">Reason for Change</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why this change is needed..."
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestAmendment}
                  disabled={submitting || !reason.trim()}
                  className="flex-1"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}