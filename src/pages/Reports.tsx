import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PhotoModal } from '@/components/PhotoModal';
import { FileText, Download, Calendar, Camera } from 'lucide-react';
import moment from 'moment';

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
  clock_in_photo?: string;
  clock_out_photo?: string;
  job?: {
    name: string;
    code: string;
  };
}

export default function Reports() {
  const { user } = useAuth();
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ClockEntry[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('this-month');
  const [loading, setLoading] = useState(true);
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
    fetchClockEntries();
  }, [user]);

  useEffect(() => {
    filterEntries();
  }, [clockEntries, selectedPeriod]);

  const fetchClockEntries = async () => {
    if (!user?.email) return;

    try {
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!worker) return;

      const { data: entries } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs:job_id(name, code)
        `)
        .eq('worker_id', worker.id)
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: false });

      setClockEntries(entries || []);
    } catch (error) {
      console.error('Error fetching clock entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    const now = moment();
    let filtered = [...clockEntries];

    switch (selectedPeriod) {
      case 'this-week':
        filtered = clockEntries.filter(entry => 
          moment(entry.clock_in).isSame(now, 'week')
        );
        break;
      case 'this-month':
        filtered = clockEntries.filter(entry => 
          moment(entry.clock_in).isSame(now, 'month')
        );
        break;
      case 'last-month':
        filtered = clockEntries.filter(entry => 
          moment(entry.clock_in).isSame(now.clone().subtract(1, 'month'), 'month')
        );
        break;
      case 'this-year':
        filtered = clockEntries.filter(entry => 
          moment(entry.clock_in).isSame(now, 'year')
        );
        break;
      default:
        break;
    }

    setFilteredEntries(filtered);
  };

  const calculateTotalHours = () => {
    return filteredEntries.reduce((total, entry) => total + (entry.total_hours || 0), 0);
  };

  const calculateTotalDays = () => {
    const uniqueDays = new Set(
      filteredEntries.map(entry => moment(entry.clock_in).format('YYYY-MM-DD'))
    );
    return uniqueDays.size;
  };

  const generateCSV = () => {
    const headers = ['Date', 'Job Code', 'Job Name', 'Clock In Time', 'Clock Out Time', 'Total Hours', 'Has Clock In Photo', 'Has Clock Out Photo'];
    const rows = filteredEntries.map(entry => [
      moment(entry.clock_in).format('YYYY-MM-DD'),
      entry.job?.code || '',
      entry.job?.name || '',
      moment(entry.clock_in).format('HH:mm'),
      entry.clock_out ? moment(entry.clock_out).format('HH:mm') : '',
      entry.total_hours?.toFixed(2) || '',
      entry.clock_in_photo ? 'Yes' : 'No',
      entry.clock_out_photo ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timesheet-${selectedPeriod}-${moment().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'this-week': return 'This Week';
      case 'this-month': return 'This Month';
      case 'last-month': return 'Last Month';
      case 'this-year': return 'This Year';
      default: return 'All Time';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading reports...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Reports</h1>
          <p className="text-muted-foreground">Download your timesheet data</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="all-time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={generateCSV} disabled={filteredEntries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <FileText className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateTotalHours().toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Worked</CardTitle>
              <Calendar className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateTotalDays()}</div>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Hours/Day</CardTitle>
              <FileText className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculateTotalDays() > 0 ? (calculateTotalHours() / calculateTotalDays()).toFixed(1) : '0'}h
              </div>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Time Entries - {getPeriodLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEntries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Photos</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
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
                        {entry.clock_out ? moment(entry.clock_out).format('h:mm A') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {entry.clock_in_photo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPhotoModal({
                                isOpen: true,
                                photoUrl: entry.clock_in_photo!,
                                workerName: user?.email || 'Worker',
                                timestamp: moment(entry.clock_in).format('DD/MM/YYYY HH:mm'),
                                jobName: entry.job?.name,
                              })}
                            >
                              <Camera className="h-4 w-4" />
                              In
                            </Button>
                          )}
                          {entry.clock_out_photo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPhotoModal({
                                isOpen: true,
                                photoUrl: entry.clock_out_photo!,
                                workerName: user?.email || 'Worker',
                                timestamp: moment(entry.clock_out).format('DD/MM/YYYY HH:mm'),
                                jobName: entry.job?.name,
                              })}
                            >
                              <Camera className="h-4 w-4" />
                              Out
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.total_hours?.toFixed(2) || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No time entries found for {getPeriodLabel().toLowerCase()}
              </div>
            )}
          </CardContent>
        </Card>

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