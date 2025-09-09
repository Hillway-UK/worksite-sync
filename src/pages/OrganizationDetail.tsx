import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Briefcase, Clock, FileText, Building, User, Mail, Phone, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [organization, setOrganization] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [clockedInWorkers, setClockedInWorkers] = useState<any[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  useEffect(() => {
    if (id) {
      fetchOrganizationData();
    }
  }, [id]);

  useEffect(() => {
    if (organization) {
      generateWeeklyReport();
    }
  }, [selectedWeek, organization]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      
      // Fetch organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (orgError) throw orgError;
      setOrganization(org);
      
      // Fetch managers
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('*')
        .eq('organization_id', id);
      
      if (managersError) throw managersError;
      setManagers(managersData || []);
      
      // Fetch workers
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('organization_id', id)
        .order('name');
      
      if (workersError) throw workersError;
      setWorkers(workersData || []);
      
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', id)
        .order('name');
      
      if (jobsError) throw jobsError;
      setJobs(jobsData || []);
      
      // Fetch currently clocked in workers
      const { data: clockedIn, error: clockedError } = await supabase
        .from('clock_entries')
        .select(`
          *,
          workers!inner(name, email),
          jobs(name, code)
        `)
        .eq('workers.organization_id', id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false });
      
      if (clockedError) throw clockedError;
      setClockedInWorkers(clockedIn || []);
      
    } catch (error: any) {
      console.error('Error fetching organization data:', error);
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyReport = async () => {
    if (!organization) return;
    
    try {
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
      
      // Fetch clock entries for the week
      const { data: entries, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          workers!inner(name, email, hourly_rate),
          jobs(name, code)
        `)
        .eq('workers.organization_id', id)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .order('clock_in');
      
      if (error) throw error;
      
      // Calculate totals
      let totalHours = 0;
      let totalPay = 0;
      const workerSummary: any = {};
      
      entries?.forEach(entry => {
        if (entry.clock_out) {
          const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
          totalHours += hours;
          
          const pay = hours * (entry.workers?.hourly_rate || 0);
          totalPay += pay;
          
          // Aggregate by worker
          if (!workerSummary[entry.worker_id]) {
            workerSummary[entry.worker_id] = {
              name: entry.workers?.name,
              hours: 0,
              pay: 0,
              entries: 0
            };
          }
          workerSummary[entry.worker_id].hours += hours;
          workerSummary[entry.worker_id].pay += pay;
          workerSummary[entry.worker_id].entries += 1;
        }
      });
      
      setWeeklyReport({
        totalHours: totalHours.toFixed(2),
        totalPay: totalPay.toFixed(2),
        totalEntries: entries?.length || 0,
        workerSummary: Object.values(workerSummary)
      });
      
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate weekly report');
    }
  };

  const exportWeeklyReport = () => {
    if (!weeklyReport) return;
    
    const csv = [
      ['Weekly Report for', organization.name],
      ['Week of', format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd, yyyy')],
      [],
      ['Worker', 'Hours', 'Pay', 'Entries'],
      ...weeklyReport.workerSummary.map((w: any) => [
        w.name,
        w.hours.toFixed(2),
        `£${w.pay.toFixed(2)}`,
        w.entries
      ]),
      [],
      ['Total', weeklyReport.totalHours, `£${weeklyReport.totalPay}`, weeklyReport.totalEntries]
    ];
    
    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${organization.name}-weekly-report-${format(selectedWeek, 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">Loading organization data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Button 
        onClick={() => navigate('/super-admin')} 
        variant="ghost" 
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Organizations
      </Button>

      {/* Organization Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building className="h-8 w-8" />
          {organization?.name}
        </h1>
        <div className="text-muted-foreground mt-2">
          <p>{organization?.email} | {organization?.phone}</p>
          <p>{organization?.address}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managers.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workers.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{clockedInWorkers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Managers Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Managers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Super Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(manager => (
                <TableRow key={manager.id}>
                  <TableCell>{manager.name}</TableCell>
                  <TableCell>{manager.email}</TableCell>
                  <TableCell>
                    <Badge variant={manager.is_super ? "default" : "secondary"}>
                      {manager.is_super ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Workers Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map(worker => (
                <TableRow key={worker.id}>
                  <TableCell>{worker.name}</TableCell>
                  <TableCell>{worker.email}</TableCell>
                  <TableCell>£{worker.hourly_rate?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>{worker.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={worker.is_active ? "default" : "secondary"}>
                      {worker.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Jobs Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id}>
                  <TableCell>{job.name}</TableCell>
                  <TableCell>{job.code}</TableCell>
                  <TableCell>{job.address || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={job.is_active ? "default" : "secondary"}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Weekly Report Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Weekly Report
          </CardTitle>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline"
              onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
            >
              Previous Week
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
            >
              Next Week
            </Button>
            <Button onClick={exportWeeklyReport}>
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Week of {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
          </div>
          
          {weeklyReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Hours</div>
                    <div className="text-2xl font-bold">{weeklyReport.totalHours}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Pay</div>
                    <div className="text-2xl font-bold">£{weeklyReport.totalPay}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Entries</div>
                    <div className="text-2xl font-bold">{weeklyReport.totalEntries}</div>
                  </CardContent>
                </Card>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Pay</TableHead>
                    <TableHead>Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyReport.workerSummary.map((worker: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{worker.name}</TableCell>
                      <TableCell>{worker.hours.toFixed(2)}</TableCell>
                      <TableCell>£{worker.pay.toFixed(2)}</TableCell>
                      <TableCell>{worker.entries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}