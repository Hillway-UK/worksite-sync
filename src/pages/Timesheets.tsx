import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Clock, MapPin, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PioneerLogo } from '@/components/PioneerLogo';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
  manual_entry?: boolean;
  auto_clocked_out?: boolean;
  notes?: string;
  job?: {
    name: string;
    code: string;
    address: string;
  };
  time_amendments?: {
    status: string;
    reason: string;
  }[];
}

interface Job {
  id: string;
  name: string;
  code: string;
  address: string;
}

export default function Timesheets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);
  const [worker, setWorker] = useState<any>(null);
  
  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    job_id: '',
    clock_in_time: '09:00',
    clock_out_time: '17:00',
    notes: ''
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submittingManual, setSubmittingManual] = useState(false);

  useEffect(() => {
    fetchWorker();
    fetchJobs();
  }, [user]);

  const fetchWorker = async () => {
    if (!user?.email) {
      navigate('/login');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      setWorker(data);
      
      if (data) {
        fetchTimesheets(data.id);
      }
    } catch (error) {
      console.error('Error fetching worker:', error);
      toast.error('Worker profile not found');
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchTimesheets = async (workerId: string) => {
    try {
      setLoading(true);
      const { data: clockEntries, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs:job_id(name, code, address),
          time_amendments(status, reason)
        `)
        .eq('worker_id', workerId)
        .order('clock_in', { ascending: false })
        .limit(50);

      if (error) throw error;

      setEntries(clockEntries || []);
      
      // Calculate total hours
      const total = clockEntries?.reduce((sum, entry) => {
        return sum + (entry.total_hours || 0);
      }, 0) || 0;
      setTotalHours(total);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  };

  const submitManualEntry = async () => {
    if (!manualEntry.job_id) {
      toast.error('Please select a job site');
      return;
    }

    if (!worker?.id) {
      toast.error('Worker profile not found');
      return;
    }

    setSubmittingManual(true);
    try {
      // Combine date and time for timestamps
      const clockInDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_in_time}:00`);
      const clockOutDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_out_time}:00`);

      // Validate times
      if (clockOutDateTime <= clockInDateTime) {
        toast.error('Clock out time must be after clock in time');
        return;
      }

      // Check for existing entries on this date
      const { data: existingEntries, error: checkError } = await supabase
        .from('clock_entries')
        .select('*')
        .eq('worker_id', worker.id)
        .gte('clock_in', `${manualEntry.date}T00:00:00`)
        .lte('clock_in', `${manualEntry.date}T23:59:59`);

      if (checkError) throw checkError;

      if (existingEntries && existingEntries.length > 0) {
        toast.error('You already have an entry for this date');
        return;
      }

      // Calculate total hours
      const timeDiff = clockOutDateTime.getTime() - clockInDateTime.getTime();
      const hours = timeDiff / (1000 * 60 * 60);

      // Create the manual entry
      const { error } = await supabase
        .from('clock_entries')
        .insert({
          worker_id: worker.id,
          job_id: manualEntry.job_id,
          clock_in: clockInDateTime.toISOString(),
          clock_out: clockOutDateTime.toISOString(),
          total_hours: hours,
          manual_entry: true,
          notes: manualEntry.notes || `Manual entry added on ${format(new Date(), 'dd/MM/yyyy')}`
        });

      if (error) throw error;

      toast.success('Manual entry added successfully');
      setShowManualEntry(false);
      setManualEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        job_id: '',
        clock_in_time: '09:00',
        clock_out_time: '17:00',
        notes: ''
      });
      fetchTimesheets(worker.id); // Refresh the timesheet
    } catch (error: any) {
      console.error('Error adding manual entry:', error);
      toast.error(error.message || 'Failed to add manual entry');
    } finally {
      setSubmittingManual(false);
    }
  };

  const getStatusBadge = (entry: ClockEntry) => {
    if (!entry.clock_out) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>;
    }
    
    if (entry.time_amendments?.some(a => a.status === 'pending')) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Amendment Pending</Badge>;
    }
    
    if (entry.time_amendments?.some(a => a.status === 'approved')) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Amendment Approved</Badge>;
    }
    
    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Completed</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading timesheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <PioneerLogo className="h-10" variant="light" />
          <h1 className="font-heading font-extrabold text-xl mt-2">My Timesheets</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Header with Manual Entry Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Recent Entries</h2>
          <Button
            onClick={() => setShowManualEntry(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Manual Entry
          </Button>
        </div>

        {/* Summary Card */}
        <Card className="mb-6 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timesheet Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{entries.length}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <p className="text-2xl font-bold text-primary">
                  {entries.filter(e => e.time_amendments?.some(a => a.status === 'pending')).length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Amendments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timesheet Entries */}
        <div className="space-y-4">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No timesheet entries found</p>
              </CardContent>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{entry.job?.name || 'Unknown Job'}</h3>
                        {getStatusBadge(entry)}
                        {entry.manual_entry && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Manual Entry
                          </Badge>
                        )}
                        {entry.auto_clocked_out && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            Auto Clock-Out
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Clock In</p>
                          <p className="font-medium">
                            {format(new Date(entry.clock_in), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        
                        {entry.clock_out && (
                          <div>
                            <p className="text-muted-foreground">Clock Out</p>
                            <p className="font-medium">
                              {format(new Date(entry.clock_out), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <p className="text-muted-foreground">Total Hours</p>
                          <p className="font-medium">
                            {entry.total_hours ? `${entry.total_hours.toFixed(2)}h` : 'In Progress'}
                          </p>
                        </div>
                        
                        {entry.job?.address && (
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {entry.job.address}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {entry.notes && (
                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                          <p className="text-sm font-medium text-gray-800">Notes</p>
                          <p className="text-sm text-gray-700">{entry.notes}</p>
                        </div>
                      )}
                      
                      {entry.time_amendments?.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-sm font-medium text-yellow-800">Amendment Request</p>
                          <p className="text-sm text-yellow-700">
                            {entry.time_amendments[0].reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Manual Entry Dialog */}
        <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Manual Time Entry</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={manualEntry.date}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, date: e.target.value }))}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <Label htmlFor="job-select">Job Site</Label>
                <Select
                  value={manualEntry.job_id}
                  onValueChange={(value) => setManualEntry(prev => ({ ...prev, job_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job site" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name} ({job.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clock-in">Clock In Time</Label>
                  <Input
                    id="clock-in"
                    type="time"
                    value={manualEntry.clock_in_time}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, clock_in_time: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="clock-out">Clock Out Time</Label>
                  <Input
                    id="clock-out"
                    type="time"
                    value={manualEntry.clock_out_time}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, clock_out_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Reason for manual entry"
                  value={manualEntry.notes}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitManualEntry}
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={submittingManual}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {submittingManual ? 'Adding...' : 'Add Entry'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Navigation */}
        <div className="mt-8 space-y-2">
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}