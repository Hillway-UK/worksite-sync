import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhotoModal } from '@/components/PhotoModal';
import { XeroSettingsModal } from '@/components/XeroSettingsModal';
import { toast } from '@/hooks/use-toast';
import { FileText, Download, ChevronDown, Camera } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, getWeek, getYear } from 'date-fns';
import moment from 'moment';

interface WeeklyData {
  worker_id: string;
  worker_name: string;
  total_hours: number;
  hourly_rate: number;
  jobs: { job_id: string; job_name: string; job_address: string; hours: number }[];
  additional_costs: number;
  total_amount: number;
  profile_photo?: string;
}

interface XeroSettings {
  prefix: string;
  startingNumber: number;
  accountCode: string;
  taxType: string;
  paymentTerms: number;
}

interface JobSiteData {
  job_id: string;
  job_name: string;
  job_address: string;
  workers: Array<{
    worker_id: string;
    worker_name: string;
    total_hours: number;
    hourly_rate: number;
    additional_costs: number;
  }>;
}

interface DetailedEntry {
  id: string;
  worker_id: string;
  worker_name: string;
  date: string;
  job_name: string;
  clock_in: string;
  clock_out: string;
  clock_in_photo?: string;
  clock_out_photo?: string;
  hours: number;
  profile_photo?: string;
}

export default function AdminReports() {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [xeroSettings, setXeroSettings] = useState<XeroSettings>({
    prefix: 'INV',
    startingNumber: 1001,
    accountCode: '4000',
    taxType: '20% VAT',
    paymentTerms: 30,
  });
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    workerName: string;
    timestamp: string;
    jobName?: string;
  }>({
    isOpen: false,
    photoUrl: '',
    workerName: '',
    timestamp: '',
    jobName: '',
  });

  useEffect(() => {
    generateReport();
    generateDetailedReport();
  }, [selectedWeek]);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Get week boundaries (Saturday to Friday)
      const weekStart = new Date(selectedWeek);
      const weekEnd = addDays(weekStart, 6);

      // Fetch workers and their data
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true);

      if (workersError) throw workersError;

      const reportData: WeeklyData[] = [];

      for (const worker of workers || []) {
        // Get total hours for the week
        const { data: hoursData } = await supabase
          .rpc('get_worker_weekly_hours', {
            worker_uuid: worker.id,
            week_start: format(weekStart, 'yyyy-MM-dd'),
          });

        const totalHours = hoursData || 0;

        // Get additional costs
        const { data: costs } = await supabase
          .from('additional_costs')
          .select('amount')
          .eq('worker_id', worker.id)
          .gte('date', format(weekStart, 'yyyy-MM-dd'))
          .lte('date', format(weekEnd, 'yyyy-MM-dd'));

        const additionalCosts = costs?.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;

        // Get profile photo
        const { data: photoData } = await supabase
          .from('clock_entries')
          .select('clock_in_photo')
          .eq('worker_id', worker.id)
          .not('clock_in_photo', 'is', null)
          .order('clock_in', { ascending: true })
          .limit(1);

        reportData.push({
          worker_id: worker.id,
          worker_name: worker.name,
          total_hours: totalHours,
          hourly_rate: worker.hourly_rate,
          jobs: [], // Simplified for now
          additional_costs: additionalCosts,
          total_amount: (totalHours * worker.hourly_rate) + additionalCosts,
          profile_photo: photoData?.[0]?.clock_in_photo || undefined,
        });
      }

      setWeeklyData(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDetailedReport = async () => {
    setLoading(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = addDays(weekStart, 6);

      const { data: entries, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          workers(name),
          jobs(name)
        `)
        .gte('clock_in', format(weekStart, 'yyyy-MM-dd'))
        .lte('clock_in', format(weekEnd, 'yyyy-MM-dd'))
        .not('clock_out', 'is', null)
        .order('worker_id')
        .order('clock_in');

      if (error) throw error;

      const detailedEntries: DetailedEntry[] = [];
      const workerPhotos: Record<string, string> = {};

      for (const entry of entries || []) {
        // Get profile photo if not already fetched
        if (!workerPhotos[entry.worker_id]) {
          const { data: photoData } = await supabase
            .from('clock_entries')
            .select('clock_in_photo')
            .eq('worker_id', entry.worker_id)
            .not('clock_in_photo', 'is', null)
            .order('clock_in', { ascending: true })
            .limit(1);
          
          workerPhotos[entry.worker_id] = photoData?.[0]?.clock_in_photo || '';
        }

        detailedEntries.push({
          id: entry.id,
          worker_id: entry.worker_id,
          worker_name: entry.workers?.name || 'Unknown',
          date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
          job_name: entry.jobs?.name || 'Unknown Job',
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          clock_in_photo: entry.clock_in_photo,
          clock_out_photo: entry.clock_out_photo,
          hours: entry.total_hours || 0,
          profile_photo: workerPhotos[entry.worker_id],
        });
      }

      setDetailedData(detailedEntries);
    } catch (error) {
      console.error('Error generating detailed report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkerExpansion = (workerId: string) => {
    setExpandedWorkers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

  const getWorkerDetailedEntries = (workerId: string) => {
    return detailedData.filter(entry => entry.worker_id === workerId);
  };

  const groupEntriesByDate = (entries: DetailedEntry[]) => {
    const grouped: Record<string, DetailedEntry[]> = {};
    entries.forEach(entry => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    return grouped;
  };

  // Utility functions for Xero export
  const extractCity = (address: string): string => {
    if (!address) return '';
    const parts = address.split(',').map(part => part.trim());
    if (parts.length < 2) return '';
    // Get the second to last part (city is usually before postcode)
    return parts[parts.length - 2] || '';
  };

  const extractPostcode = (address: string): string => {
    if (!address) return '';
    const parts = address.split(' ');
    // Get the last 1-2 parts as postcode (UK format)
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join(' ');
      // Check if it looks like a UK postcode
      if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(lastTwo)) {
        return lastTwo.toUpperCase();
      }
    }
    return parts[parts.length - 1] || '';
  };

  const getNextInvoiceNumber = (): string => {
    const lastNumber = parseInt(localStorage.getItem('xero_last_invoice_number') || xeroSettings.startingNumber.toString());
    const nextNumber = lastNumber + 1;
    localStorage.setItem('xero_last_invoice_number', nextNumber.toString());
    
    const year = getYear(new Date());
    return `${xeroSettings.prefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
  };

  const fetchJobSiteData = async (): Promise<JobSiteData[]> => {
    const weekStart = new Date(selectedWeek);
    const weekEnd = addDays(weekStart, 6);

    // Fetch clock entries with job and worker details
    const { data: entries, error } = await supabase
      .from('clock_entries')
      .select(`
        *,
        workers(id, name, hourly_rate),
        jobs(id, name, address)
      `)
      .gte('clock_in', format(weekStart, 'yyyy-MM-dd'))
      .lte('clock_in', format(weekEnd, 'yyyy-MM-dd'))
      .not('clock_out', 'is', null);

    if (error) throw error;

    // Fetch additional costs for the period
    const { data: additionalCosts } = await supabase
      .from('additional_costs')
      .select('*')
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'));

    // Group by job site
    const jobSiteMap: Record<string, JobSiteData> = {};

    entries?.forEach(entry => {
      const jobId = entry.jobs?.id;
      const jobName = entry.jobs?.name || 'Unknown Job';
      const jobAddress = entry.jobs?.address || '';

      if (!jobSiteMap[jobId]) {
        jobSiteMap[jobId] = {
          job_id: jobId,
          job_name: jobName,
          job_address: jobAddress,
          workers: []
        };
      }

      // Find or create worker entry for this job site
      let workerEntry = jobSiteMap[jobId].workers.find(w => w.worker_id === entry.worker_id);
      if (!workerEntry) {
        workerEntry = {
          worker_id: entry.worker_id,
          worker_name: entry.workers?.name || 'Unknown',
          total_hours: 0,
          hourly_rate: entry.workers?.hourly_rate || 0,
          additional_costs: 0
        };
        jobSiteMap[jobId].workers.push(workerEntry);
      }

      workerEntry.total_hours += entry.total_hours || 0;
    });

    // Add additional costs to worker entries
    additionalCosts?.forEach(cost => {
      Object.values(jobSiteMap).forEach(jobSite => {
        const workerEntry = jobSite.workers.find(w => w.worker_id === cost.worker_id);
        if (workerEntry) {
          workerEntry.additional_costs += Number(cost.amount);
        }
      });
    });

    return Object.values(jobSiteMap).filter(jobSite => jobSite.workers.length > 0);
  };

  const generateXeroCSV = async () => {
    try {
      setLoading(true);
      const jobSiteData = await fetchJobSiteData();
      
      if (jobSiteData.length === 0) {
        toast({
          title: "No Data",
          description: "No timesheet data found for the selected week",
          variant: "destructive",
        });
        return;
      }

      const weekStart = new Date(selectedWeek);
      const weekEnd = addDays(weekStart, 6);
      const invoiceDate = format(new Date(), 'dd/MM/yyyy');
      const dueDate = format(addDays(new Date(), xeroSettings.paymentTerms), 'dd/MM/yyyy');
      const weekNumber = getWeek(weekStart);
      const year = getYear(weekStart);

      // Xero CSV headers with asterisks for required fields
      const csvHeaders = [
        '*ContactName',
        'EmailAddress',
        'POAddressLine1',
        'POCity',
        'POPostalCode',
        '*InvoiceNumber',
        '*InvoiceDate',
        '*DueDate',
        'Description',
        '*Quantity',
        '*UnitAmount',
        '*AccountCode',
        '*TaxType',
        'Currency'
      ];

      const csvRows: string[][] = [];

      jobSiteData.forEach(jobSite => {
        const invoiceNumber = getNextInvoiceNumber();
        const city = extractCity(jobSite.job_address);
        const postcode = extractPostcode(jobSite.job_address);

        jobSite.workers.forEach(worker => {
          if (worker.total_hours > 0) {
            // Add worker hours line
            csvRows.push([
              jobSite.job_name,
              '',
              jobSite.job_address,
              city,
              postcode,
              invoiceNumber,
              invoiceDate,
              dueDate,
              `Construction Labour - ${worker.worker_name} - Week ${weekNumber} ${year}`,
              worker.total_hours.toFixed(2),
              worker.hourly_rate.toFixed(2),
              xeroSettings.accountCode,
              xeroSettings.taxType,
              'GBP'
            ]);
          }

          // Add additional costs line if any
          if (worker.additional_costs > 0) {
            csvRows.push([
              jobSite.job_name,
              '',
              jobSite.job_address,
              city,
              postcode,
              invoiceNumber,
              invoiceDate,
              dueDate,
              `Additional Costs - ${worker.worker_name}`,
              '1',
              worker.additional_costs.toFixed(2),
              xeroSettings.accountCode,
              xeroSettings.taxType,
              'GBP'
            ]);
          }
        });
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Xero_Export_${format(weekStart, 'dd-MM-yyyy')}_to_${format(weekEnd, 'dd-MM-yyyy')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Xero invoice file exported successfully",
      });
    } catch (error) {
      console.error('Error generating Xero export:', error);
      toast({
        title: "Error",
        description: "Failed to generate Xero export",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = () => {
    const weekStart = new Date(selectedWeek);
    const weekEnd = addDays(weekStart, 6);
    const invoiceDate = format(weekStart, 'yyyy-MM-dd');
    const dueDate = format(addDays(weekStart, 7), 'yyyy-MM-dd');

    const csvHeaders = [
      'ContactName',
      'EmailAddress',
      'InvoiceNumber',
      'InvoiceDate',
      'DueDate',
      'Description',
      'Quantity',
      'UnitAmount',
      'AccountCode',
      'TaxType',
      'TrackingName1',
      'TrackingOption1'
    ];

    const csvRows = weeklyData.map((worker, index) => [
      worker.worker_name,
      `worker${worker.worker_id.slice(-4)}@company.com`,
      `WE-${format(weekEnd, 'yyyyMMdd')}-${worker.worker_id.slice(-4)}`,
      invoiceDate,
      dueDate,
      `Construction work - Week ending ${format(weekEnd, 'dd/MM/yyyy')}`,
      worker.total_hours.toString(),
      worker.hourly_rate.toString(),
      '200',
      'No VAT',
      'Job',
      'CONSTRUCTION'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${format(weekEnd, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "CSV file downloaded successfully",
    });
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Weekly Reports
          </h1>
          <p className="text-muted-foreground">
            Generate Xero-compatible payroll reports
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 items-end">
            <div>
              <Label htmlFor="week">Week Starting (Saturday)</Label>
              <Input
                id="week"
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
              />
            </div>
            <Button onClick={generateReport} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button onClick={generateCSV} disabled={weeklyData.length === 0} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Weekly Summary</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Timesheet</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Weekly Summary</CardTitle>
                  <div className="flex items-center gap-2">
                    <XeroSettingsModal onSettingsChange={setXeroSettings} />
                    <Button 
                      onClick={generateXeroCSV} 
                      disabled={weeklyData.length === 0 || loading}
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export to Xero
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Additional Costs</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6">
                          No data for selected week
                        </TableCell>
                      </TableRow>
                    ) : (
                      weeklyData.map((worker) => (
                        <TableRow key={worker.worker_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {worker.profile_photo ? (
                                  <>
                                    <AvatarImage src={worker.profile_photo} alt={worker.worker_name} />
                                    <AvatarFallback>
                                      {worker.worker_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    {worker.worker_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              {worker.worker_name}
                            </div>
                          </TableCell>
                          <TableCell>{worker.total_hours.toFixed(1)}h</TableCell>
                          <TableCell>£{worker.hourly_rate.toFixed(2)}</TableCell>
                          <TableCell>£{worker.additional_costs.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">£{worker.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {worker.profile_photo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPhotoModal({
                                  isOpen: true,
                                  photoUrl: worker.profile_photo!,
                                  workerName: worker.worker_name,
                                  timestamp: 'Profile Photo',
                                })}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Timesheet</CardTitle>
              </CardHeader>
              <CardContent>
                {detailedData.length === 0 ? (
                  <div className="text-center py-6">No detailed data for selected week</div>
                ) : (
                  <div className="space-y-4">
                    {Array.from(new Set(detailedData.map(entry => entry.worker_id))).map(workerId => {
                      const workerEntries = getWorkerDetailedEntries(workerId);
                      const workerName = workerEntries[0]?.worker_name;
                      const totalHours = workerEntries.reduce((sum, entry) => sum + entry.hours, 0);
                      const isExpanded = expandedWorkers.has(workerId);
                      const groupedByDate = groupEntriesByDate(workerEntries);

                      return (
                        <Collapsible key={workerId}>
                          <CollapsibleTrigger
                            className="flex items-center justify-between w-full p-4 bg-muted rounded-lg hover:bg-muted/80"
                            onClick={() => toggleWorkerExpansion(workerId)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {workerEntries[0]?.profile_photo ? (
                                  <>
                                    <AvatarImage src={workerEntries[0].profile_photo} alt={workerName} />
                                    <AvatarFallback>
                                      {workerName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    {workerName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span className="font-semibold">{workerName}</span>
                              <span className="text-muted-foreground">| Total Hours: {totalHours.toFixed(1)}</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent className="space-y-2 mt-2">
                            {Object.entries(groupedByDate).map(([date, dayEntries]) => (
                              <div key={date} className="ml-4 space-y-1">
                                <div className="font-medium text-sm">
                                  {moment(date).format('dddd DD/MM')} | {dayEntries[0]?.job_name}
                                </div>
                                {dayEntries.map(entry => (
                                  <div key={entry.id} className="ml-4 text-sm flex items-center gap-4 py-1">
                                    <span>Clock In: {moment(entry.clock_in).format('HH:mm')}</span>
                                    {entry.clock_in_photo && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-1"
                                        onClick={() => setPhotoModal({
                                          isOpen: true,
                                          photoUrl: entry.clock_in_photo!,
                                          workerName: entry.worker_name,
                                          timestamp: moment(entry.clock_in).format('DD/MM/YYYY HH:mm'),
                                          jobName: entry.job_name,
                                        })}
                                      >
                                        <Camera className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <span>| Clock Out: {moment(entry.clock_out).format('HH:mm')}</span>
                                    {entry.clock_out_photo && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-1"
                                        onClick={() => setPhotoModal({
                                          isOpen: true,
                                          photoUrl: entry.clock_out_photo!,
                                          workerName: entry.worker_name,
                                          timestamp: moment(entry.clock_out).format('DD/MM/YYYY HH:mm'),
                                          jobName: entry.job_name,
                                        })}
                                      >
                                        <Camera className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <span>| Hours: {entry.hours.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PhotoModal
          isOpen={photoModal.isOpen}
          onClose={() => setPhotoModal(prev => ({ ...prev, isOpen: false }))}
          photoUrl={photoModal.photoUrl}
          workerName={photoModal.workerName}
          timestamp={photoModal.timestamp}
          jobName={photoModal.jobName}
        />
      </div>
    </Layout>
  );
}