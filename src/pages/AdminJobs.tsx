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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  show_rams_and_site_info?: boolean;
  created_at: string;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [showJobsTour, setShowJobsTour] = useState(false);
  const [showRamsGlobal, setShowRamsGlobal] = useState<boolean>(true);
  const [updatingGlobal, setUpdatingGlobal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean>(true);

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

  useEffect(() => {
    if (jobs.length > 0) {
      // Set global toggle based on majority of jobs
      const enabledCount = jobs.filter(j => j.show_rams_and_site_info !== false).length;
      setShowRamsGlobal(enabledCount > jobs.length / 2);
    }
  }, [jobs]);

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

  const handleGlobalToggleChange = (newValue: boolean) => {
    setPendingToggleValue(newValue);
    setShowConfirmDialog(true);
  };

  const confirmGlobalToggle = async () => {
    try {
      setUpdatingGlobal(true);
      
      // Get manager's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: manager } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', user.email)
        .maybeSingle();
      
      if (!manager?.organization_id) return;

      // Batch update all jobs in this organization
      const { error } = await supabase
        .from('jobs')
        .update({ show_rams_and_site_info: pendingToggleValue } as any)
        .eq('organization_id', manager.organization_id);

      if (error) throw error;

      // Update local state
      setShowRamsGlobal(pendingToggleValue);
      
      toast({
        title: "Success",
        description: `RAMS & Site Info ${pendingToggleValue ? 'enabled' : 'disabled'} for all jobs`,
      });

      // Refresh jobs list
      fetchJobs();
    } catch (error: any) {
      console.error('Error updating global toggle:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setUpdatingGlobal(false);
      setShowConfirmDialog(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);

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
        .maybeSingle();
      
      if (managerError || !manager?.organization_id) {
        toast({
          title: "Error",
          description: "No organization found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch jobs from this organization
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', manager.organization_id)
        .order('name');

      if (jobsError) throw jobsError;
      
      setJobs(jobsData || []);

      // Fetch ALL active clock entries for this organization's jobs in ONE query
      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map(job => job.id);
        
        const { data: activeClockEntries, error: clockError } = await supabase
          .from('clock_entries')
          .select('job_id')
          .in('job_id', jobIds)
          .is('clock_out', null);

        if (!clockError && activeClockEntries) {
          // Aggregate counts by job_id
          const counts: Record<string, number> = {};
          activeClockEntries.forEach(entry => {
            counts[entry.job_id] = (counts[entry.job_id] || 0) + 1;
          });
          setWorkerCounts(counts);
        } else {
          // If error or no data, set all counts to 0
          const counts: Record<string, number> = {};
          jobsData.forEach(job => {
            counts[job.id] = 0;
          });
          setWorkerCounts(counts);
        }
      } else {
        setWorkerCounts({});
      }

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
    if (!confirm('Are you sure you want to delete this job? This will also delete all associated time entries, job assignments, and related data. This action cannot be undone.')) {
      return;
    }
    
    try {
      // Step 1: Get all clock entries for this job
      const { data: clockEntries } = await supabase
        .from('clock_entries')
        .select('id')
        .eq('job_id', jobId);
      
      if (clockEntries && clockEntries.length > 0) {
        const clockEntryIds = clockEntries.map(ce => ce.id);
        
        // Delete time amendments (references clock_entries)
        const { error: amendmentsError } = await supabase
          .from('time_amendments')
          .delete()
          .in('clock_entry_id', clockEntryIds);
        
        if (amendmentsError) {
          console.error('Error deleting time amendments:', amendmentsError);
        }
        
        // Delete additional costs (references clock_entries)
        const { error: costsError } = await supabase
          .from('additional_costs')
          .delete()
          .in('clock_entry_id', clockEntryIds);
        
        if (costsError) {
          console.error('Error deleting additional costs:', costsError);
        }
        
        // Delete clock entry history (references clock_entries)
        const { error: historyError } = await supabase
          .from('clock_entry_history')
          .delete()
          .in('clock_entry_id', clockEntryIds);
        
        if (historyError) {
          console.error('Error deleting clock entry history:', historyError);
        }
      }
      
      // Step 2: Delete all clock entries for this job
      const { error: clockEntriesError } = await supabase
        .from('clock_entries')
        .delete()
        .eq('job_id', jobId);
      
      if (clockEntriesError) {
        console.error('Error deleting clock entries:', clockEntriesError);
        throw new Error('Failed to delete clock entries: ' + clockEntriesError.message);
      }
      
      // Step 3: Delete the job (cascades to job_assignments automatically)
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
      
      if (jobError) throw jobError;
      
      toast({
        title: "Success",
        description: "Job and all related data deleted successfully",
      });
      
      fetchJobs(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
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
          <CardHeader className="flex flex-col space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Jobs ({jobs.length})</CardTitle>
                
                {/* Global RAMS Toggle */}
                <div id="rams-global-toggle" className="flex items-center gap-2 border-l pl-4">
                  <Switch
                    checked={showRamsGlobal}
                    onCheckedChange={handleGlobalToggleChange}
                    disabled={updatingGlobal || jobs.length === 0}
                  />
                  <Label className="text-sm font-normal cursor-pointer">
                    Show RAMS & Site Info
                  </Label>
                </div>
              </div>
              
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
          completionDescription="You now know how to manage jobs! If you want a refresher later, just click the 'Tutorial' button on this page."
          exploreButtonText="Explore Jobs"
        />

        {/* Confirmation Dialog for Global Toggle */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply to All Jobs?</AlertDialogTitle>
              <AlertDialogDescription>
                This will {pendingToggleValue ? 'show' : 'hide'} RAMS & Site Information 
                documents for all {jobs.length} job(s) in your organization. 
                {!pendingToggleValue && ' Workers will not be able to view or accept these documents.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingGlobal}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmGlobalToggle}
                disabled={updatingGlobal}
              >
                {updatingGlobal ? 'Updating...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    );
  }