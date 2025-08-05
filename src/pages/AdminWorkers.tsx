import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { WorkerDialog } from '@/components/WorkerDialog';
import { toast } from '@/hooks/use-toast';
import { Users, Search, ToggleLeft, ToggleRight } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [weeklyHours, setWeeklyHours] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name');

      if (error) throw error;
      setWorkers(data || []);

      // Fetch weekly hours for each worker
      const hours: Record<string, number> = {};
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekStartStr = weekStart.toISOString().split('T')[0];

      for (const worker of data || []) {
        try {
          const { data: hoursData, error: hoursError } = await supabase
            .rpc('get_worker_weekly_hours', {
              worker_uuid: worker.id,
              week_start: weekStartStr,
            });

          if (!hoursError) {
            hours[worker.id] = hoursData || 0;
          }
        } catch (error) {
          console.error(`Error fetching hours for worker ${worker.id}:`, error);
        }
      }
      setWeeklyHours(hours);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to load workers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkerStatus = async (workerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ is_active: !currentStatus })
        .eq('id', workerId);

      if (error) throw error;

      setWorkers(workers.map(worker =>
        worker.id === workerId
          ? { ...worker, is_active: !currentStatus }
          : worker
      ));

      toast({
        title: "Success",
        description: `Worker ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating worker status:', error);
      toast({
        title: "Error",
        description: "Failed to update worker status",
        variant: "destructive",
      });
    }
  };

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading workers...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <Users className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Workers Management
          </h1>
          <p className="text-muted-foreground">
            Manage your workforce and worker profiles
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Workers ({workers.length})</CardTitle>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <WorkerDialog onSave={fetchWorkers} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead>Weekly Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        {searchTerm ? 'No workers found matching your search.' : 'No workers found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWorkers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell className="font-medium">{worker.name}</TableCell>
                        <TableCell>{worker.email}</TableCell>
                        <TableCell>{worker.phone || '-'}</TableCell>
                        <TableCell>£{worker.hourly_rate.toFixed(2)}</TableCell>
                        <TableCell>
                          {weeklyHours[worker.id]?.toFixed(1) || '0.0'}h
                        </TableCell>
                        <TableCell>
                          <Badge variant={worker.is_active ? "default" : "secondary"}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <WorkerDialog 
                              worker={worker} 
                              onSave={fetchWorkers}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleWorkerStatus(worker.id, worker.is_active)}
                            >
                              {worker.is_active ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}