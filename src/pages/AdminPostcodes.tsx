import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export default function AdminPostcodes() {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ imported: number; errors: number } | null>(null);
  const [postcodeCount, setPostcodeCount] = useState<number | null>(null);

  const fetchPostcodeCount = async () => {
    const { count, error } = await supabase
      .from('postcodes')
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      setPostcodeCount(count);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setStats(null);

    try {
      toast({
        title: "Import Started",
        description: "Importing UK postcodes... This may take a few minutes.",
      });

      const { data, error } = await supabase.functions.invoke('import-uk-postcodes', {
        body: { 
          source: 'freemaptools',
          // limit: 1000 // Uncomment to test with limited records
        }
      });

      if (error) throw error;

      setStats({
        imported: data.imported || 0,
        errors: data.errors || 0,
      });

      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} UK postcodes`,
      });

      // Refresh postcode count
      await fetchPostcodeCount();

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import postcodes",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setProgress(100);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to delete all postcodes? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('postcodes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast({
        title: "Database Cleared",
        description: "All postcodes have been removed",
      });

      setPostcodeCount(0);
      setStats(null);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear database",
        variant: "destructive",
      });
    }
  };

  // Fetch count on mount
  useState(() => {
    fetchPostcodeCount();
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">UK Postcode Database Management</h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Status
              </CardTitle>
              <CardDescription>
                Current postcode database information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Postcodes in Database:</span>
                  <span className="text-2xl font-bold">
                    {postcodeCount !== null ? postcodeCount.toLocaleString() : 'Loading...'}
                  </span>
                </div>

                {postcodeCount === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Database Empty</AlertTitle>
                    <AlertDescription>
                      The postcode database is currently empty. Import UK postcodes to enable geocoding functionality.
                    </AlertDescription>
                  </Alert>
                )}

                {postcodeCount !== null && postcodeCount > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Database Active</AlertTitle>
                    <AlertDescription>
                      Postcode database contains {postcodeCount.toLocaleString()} records and is ready for use.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Import UK Postcodes
              </CardTitle>
              <CardDescription>
                Import UK postcode data with latitude and longitude coordinates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>About UK Postcodes</AlertTitle>
                <AlertDescription>
                  This will import UK outward code postcodes (~3,000 records) with latitude and longitude data.
                  These provide coverage for all major UK areas and will significantly improve geocoding accuracy.
                </AlertDescription>
              </Alert>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Importing postcodes... Please wait.
                  </p>
                </div>
              )}

              {stats && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Import Complete</AlertTitle>
                  <AlertDescription>
                    Successfully imported {stats.imported.toLocaleString()} postcodes
                    {stats.errors > 0 && ` with ${stats.errors} errors`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {importing ? 'Importing...' : 'Import UK Postcodes'}
                </Button>

                <Button
                  onClick={handleClearDatabase}
                  variant="destructive"
                  disabled={importing || postcodeCount === 0}
                >
                  Clear Database
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Data Source:</strong> FreeMapTools UK Postcode Outward Codes</p>
                <p><strong>Coverage:</strong> All UK outward postcode areas</p>
                <p><strong>Format:</strong> Postcode, Latitude, Longitude</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
