import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { format } from 'date-fns';

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
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

export default function Timesheets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    fetchTimesheets();
  }, [user]);

  const fetchTimesheets = async () => {
    if (!user?.email) {
      navigate('/login');
      return;
    }

    try {
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!worker) {
        toast.error('Worker profile not found');
        return;
      }

      const { data: clockEntries, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs:job_id(name, code, address),
          time_amendments(status, reason)
        `)
        .eq('worker_id', worker.id)
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
          <AutoTimeLogo className="h-10" variant="light" />
          <h1 className="font-heading font-extrabold text-xl mt-2">My Timesheets</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
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