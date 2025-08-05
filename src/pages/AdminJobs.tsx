import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { JobDialog } from '@/components/JobDialog';
import { toast } from '@/hooks/use-toast';
import { Briefcase, Search, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';

interface Job {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('name');

      if (error) throw error;
      setJobs(data || []);

      // Fetch worker counts for each job
      const counts: Record<string, number> = {};
      for (const job of data || []) {
        try {
          const { count, error: countError } = await supabase
            .from('clock_entries')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)
            .is('clock_out', null);

          if (!countError) {
            counts[job.id] = count || 0;
          }
        } catch (error) {
          console.error(`Error fetching worker count for job ${job.id}:`, error);
        }
      }
      setWorkerCounts(counts);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(job =>
        job.id === jobId
          ? { ...job, is_active: !currentStatus }
          : job
      ));

      toast({
        title: "Success",
        description: `Job ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  const filteredJobs = jobs.filter(job =>
    job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading jobs...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <Briefcase className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Jobs Management
          </h1>
          <p className="text-muted-foreground">
            Manage construction jobs and project sites
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Jobs ({jobs.length})</CardTitle>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <JobDialog onSave={fetchJobs} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Geofence</TableHead>
                    <TableHead>Workers On Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        {searchTerm ? 'No jobs found matching your search.' : 'No jobs found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.code}</TableCell>
                        <TableCell>{job.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{job.address}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.geofence_radius}m
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={workerCounts[job.id] > 0 ? "default" : "secondary"}>
                            {workerCounts[job.id] || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.is_active ? "default" : "secondary"}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <JobDialog 
                              job={job} 
                              onSave={fetchJobs}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleJobStatus(job.id, job.is_active)}
                            >
                              {job.is_active ? (
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