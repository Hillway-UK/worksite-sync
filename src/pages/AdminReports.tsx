import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { FileText, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

interface WeeklyData {
  worker_id: string;
  worker_name: string;
  total_hours: number;
  hourly_rate: number;
  jobs: { job_name: string; hours: number }[];
  additional_costs: number;
  total_amount: number;
}

export default function AdminReports() {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateReport();
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

        reportData.push({
          worker_id: worker.id,
          worker_name: worker.name,
          total_hours: totalHours,
          hourly_rate: worker.hourly_rate,
          jobs: [], // Simplified for now
          additional_costs: additionalCosts,
          total_amount: (totalHours * worker.hourly_rate) + additionalCosts,
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

        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      No data for selected week
                    </TableCell>
                  </TableRow>
                ) : (
                  weeklyData.map((worker) => (
                    <TableRow key={worker.worker_id}>
                      <TableCell className="font-medium">{worker.worker_name}</TableCell>
                      <TableCell>{worker.total_hours.toFixed(1)}h</TableCell>
                      <TableCell>£{worker.hourly_rate.toFixed(2)}</TableCell>
                      <TableCell>£{worker.additional_costs.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">£{worker.total_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}