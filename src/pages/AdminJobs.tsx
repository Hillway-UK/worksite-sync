import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { JobDialog } from '@/components/JobDialog';
import { AddressDisplay } from '@/components/AddressDisplay';
import { toast } from '@/hooks/use-toast';
import { Briefcase, Search, MapPin, ToggleLeft, ToggleRight, Plus, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ManagerTourGate } from '@/components/onboarding/ManagerTourGate';
import { jobsSteps } from '@/config/onboarding';
import {
  shouldAutoContinueJobsPage,
  setAutoContinueJobsPage,
  setAutoContinueAmendmentsPage,
  markPageTutorialComplete,
} from '@/lib/supabase/manager-tutorial';

interface Job {
  id: string;
  code: string;
  name: string;
  address: string; // Legacy field
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  county?: string;
  postcode?: string;
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
  const [showJobsTour, setShowJobsTour] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const checkAutoRun = async () => {
      const shouldRun = await shouldAutoContinueJobsPage();
      if (shouldRun) {
        setTimeout(() => setShowJobsTour(true), 800);
        await setAutoContinueJobsPage(false);
      }
    };
    checkAutoRun();
  }, []);

  const handleJobsTourEnd = async () => {
    setShowJobsTour(false);
    await markPageTutorialComplete('jobs');
  };

  const handleJobsStepChange = async (stepIndex: number) => {
    // If user reaches the Amendments navigation step (step 10), set flag
    if (stepIndex === 10) {
      await setAutoContinueAmendmentsPage(true);
    }
  };

  const fetchJobs = async () => {
    try {
      // Get manager's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setLoading(false);
        return;
      }

      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', user.email)
        .single();
      
      if (managerError || !manager?.organization_id) {
        toast({
          title: "Error",
          description: "No organization found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch only jobs from this organization
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', manager.organization_id)
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

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
      fetchJobs(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    }
  };

  // Filter jobs based on search term
  const filteredJobs = jobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    return (
      job.name.toLowerCase().includes(searchLower) ||
      job.code.toLowerCase().includes(searchLower) ||
      job.address.toLowerCase().includes(searchLower) ||
      job.address_line_1?.toLowerCase().includes(searchLower) ||
      job.city?.toLowerCase().includes(searchLower) ||
      job.postcode?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <div className="flex gap-4">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-20" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-8 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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

        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Jobs ({jobs.length})</CardTitle>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="job-search"
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJobsTour(true)}
                className="gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                Tutorial
              </Button>
              <JobDialog onSave={fetchJobs} triggerClassName="btn-add-job" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
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
                      <TableCell colSpan={7} className="text-center py-12">
                        {searchTerm ? (
                          <div>
                            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg font-medium mb-2">
                              No jobs found matching your search
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try adjusting your search terms
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg font-medium mb-4">
                              Add your first job to get started
                            </p>
                            <JobDialog 
                              onSave={fetchJobs}
                              trigger={
                                <Button 
                                  className="hover:bg-primary/90"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Job
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                <TableCell className="font-medium job-code-cell">{job.code}</TableCell>
                <TableCell>{job.name}</TableCell>
                <TableCell className="max-w-xs">
                  <AddressDisplay
                    address={job.address}
                    address_line_1={job.address_line_1}
                    address_line_2={job.address_line_2}
                    city={job.city}
                    county={job.county}
                    postcode={job.postcode}
                    className="text-sm"
                  />
                </TableCell>
                        <TableCell className="geofence-cell">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.geofence_radius}m
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={workerCounts[job.id] > 0 ? "default" : "secondary"}
                            className="workers-on-site-badge"
                          >
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
                              triggerClassName="job-edit-button"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:bg-secondary/80 hover:scale-105 transition-transform duration-200 job-toggle-button"
                              onClick={() => toggleJobStatus(job.id, job.is_active)}
                            >
                              {job.is_active ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 job-delete-button"
                              onClick={() => handleDeleteJob(job.id)}
                            >
                              Delete
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

        <ManagerTourGate
          steps={jobsSteps}
          autoRun={false}
          forceRun={showJobsTour}
          onTourEnd={handleJobsTourEnd}
          onStepChange={handleJobsStepChange}
        />
      </Layout>
    );
  }