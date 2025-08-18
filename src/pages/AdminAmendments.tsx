import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import moment from 'moment';
import { ExpenseTypesManager } from '@/components/ExpenseTypesManager';

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
    try {
      const { error } = await supabase
        .from('time_amendments')
        .update({
          status,
          manager_notes: managerNotes,
          processed_at: new Date().toISOString()
        })
        .eq('id', amendmentId);

      if (error) throw error;

      toast({
        title: `Amendment ${status}`,
        description: `Time amendment has been ${status}.`,
      });

      setSelectedAmendment(null);
      setManagerNotes('');
      fetchAmendments();
    } catch (error) {
      console.error('Error updating amendment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update amendment.',
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

        <div className="space-y-6">
          <ExpenseTypesManager />

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
                          <div>Submitted: {moment(amendment.created_at).format('MMM D, h:mm A')}</div>
                          {amendment.requested_clock_in && (
                            <div>In: {moment(amendment.requested_clock_in).format('MMM D, h:mm A')}</div>
                          )}
                          {amendment.requested_clock_out && (
                            <div>Out: {moment(amendment.requested_clock_out).format('MMM D, h:mm A')}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{amendment.reason}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(amendment.status)}</TableCell>
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
        </div>

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
                    className="flex-1 hover:bg-primary/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleApproval(selectedAmendment.id, 'rejected')}
                    variant="destructive"
                    className="flex-1 hover:bg-destructive/90"
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