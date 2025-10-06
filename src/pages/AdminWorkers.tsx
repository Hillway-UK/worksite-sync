import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WorkerDialog } from '@/components/WorkerDialog';
import { PhotoModal } from '@/components/PhotoModal';
import { toast } from '@/hooks/use-toast';
import { Users, Search, ToggleLeft, ToggleRight, Camera, Users2, Plus, Trash2, MoreVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCapacityCheck } from '@/hooks/useCapacityCheck';
import { CapacityLimitDialog } from '@/components/CapacityLimitDialog';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  profile_photo?: string;
}

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [weeklyHours, setWeeklyHours] = useState<Record<string, number>>({});
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    workerName: string;
    timestamp: string;
  }>({
    isOpen: false,
    photoUrl: '',
    workerName: '',
    timestamp: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    worker: Worker | null;
  }>({
    isOpen: false,
    worker: null,
  });
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [capacityLimitDialog, setCapacityLimitDialog] = useState({
    open: false,
    type: 'worker' as 'manager' | 'worker',
    planName: '',
    currentCount: 0,
    maxAllowed: null as number | null,
    plannedCount: 0
  });
  
  const { checkCapacity } = useCapacityCheck();

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      // Get current user's organization first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "Not authenticated",
          variant: "destructive",
        });
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
          description: "Your admin account is not linked to an organization. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      // Fetch only workers from this organization
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('organization_id', manager.organization_id)
        .order('name');

      if (workersError) throw workersError;

      // Get first photo for each worker
      const workersWithPhotos = await Promise.all(
        (workersData || []).map(async (worker) => {
          const { data: photoData } = await supabase
            .from('clock_entries')
            .select('clock_in_photo, clock_in')
            .eq('worker_id', worker.id)
            .not('clock_in_photo', 'is', null)
            .order('clock_in', { ascending: true })
            .limit(1);

          return {
            ...worker,
            profile_photo: photoData?.[0]?.clock_in_photo || null,
          };
        })
      );

      setWorkers(workersWithPhotos);

      // Fetch weekly hours for each worker
      const hours: Record<string, number> = {};
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekStartStr = weekStart.toISOString().split('T')[0];

      for (const worker of workersWithPhotos || []) {
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

  const deleteWorker = async (worker: Worker) => {
    setOperationLoading(prev => ({ ...prev, [worker.id]: true }));
    try {
      // Call edge function to delete both database record and auth user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { email: worker.email, table: 'workers' }
      });

      if (error) throw error;

      setWorkers(workers.filter(w => w.id !== worker.id));
      setDeleteDialog({ isOpen: false, worker: null });
      
      toast({
        title: "Success",
        description: `Worker ${worker.name} has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast({
        title: "Error",
        description: "Failed to delete worker",
        variant: "destructive",
      });
    } finally {
      setOperationLoading(prev => ({ ...prev, [worker.id]: false }));
    }
  };


  const handleAddWorker = async () => {
    try {
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('User fetch error:', userError);
        setWorkerDialogOpen(true);
        return;
      }

      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', currentUser.user?.email)
        .single();

      if (managerError) {
        console.error('Manager fetch error:', managerError);
        setWorkerDialogOpen(true);
        return;
      }

      // Check subscription capacity
      const capacityCheck = await checkCapacity(manager.organization_id, 'worker');
      
      if (!capacityCheck.allowed) {
        if (capacityCheck.capacity) {
          setCapacityLimitDialog({
            open: true,
            type: 'worker',
            planName: capacityCheck.capacity.planName,
            currentCount: capacityCheck.capacity.currentWorkerCount,
            maxAllowed: capacityCheck.capacity.maxWorkers,
            plannedCount: capacityCheck.capacity.plannedWorkers
          });
        } else {
          toast({
            title: "Error",
            description: capacityCheck.error || 'Cannot add worker at this time',
            variant: "destructive",
          });
        }
        return;
      }
      
      // Open dialog if checks pass
      setWorkerDialogOpen(true);
    } catch (error) {
      console.error('Error checking worker limit:', error);
      setWorkerDialogOpen(true);
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
          <div className="text-center mb-8">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-4">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead>Weekly Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
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
          <Users className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Workers Management
          </h1>
          <p className="text-muted-foreground">
            Manage your workforce and worker profiles
          </p>
        </div>

        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
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
              <Button 
                onClick={() => handleAddWorker()}
                className="bg-black hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Worker
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
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
                      <TableCell colSpan={7} className="text-center py-12">
                        {searchTerm ? (
                          <div>
                            <Users2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg font-medium mb-2">
                              No workers found matching your search
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try adjusting your search terms
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Users2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg font-medium mb-4">
                              Add your first worker to get started
                            </p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWorkers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              {worker.profile_photo ? (
                                <>
                                  <AvatarImage 
                                    src={worker.profile_photo} 
                                    alt={worker.name}
                                  />
                                  <AvatarFallback>
                                    {worker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </>
                              ) : (
                                <AvatarFallback>
                                  {worker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <div className="font-medium">{worker.name}</div>
                              {worker.profile_photo && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-muted-foreground hover:scale-105 transition-transform duration-200"
                                  onClick={() => setPhotoModal({
                                    isOpen: true,
                                    photoUrl: worker.profile_photo!,
                                    workerName: worker.name,
                                    timestamp: 'Profile Photo',
                                  })}
                                >
                                  <Camera className="h-3 w-3 mr-1" />
                                  View Photo
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-secondary/80"
                                  disabled={operationLoading[worker.id]}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleWorkerStatus(worker.id, worker.is_active)}
                                  disabled={operationLoading[worker.id]}
                                >
                                  {worker.is_active ? (
                                    <>
                                      <ToggleLeft className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <ToggleRight className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteDialog({ isOpen: true, worker })}
                                  className="text-destructive"
                                  disabled={operationLoading[worker.id]}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Worker
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        {/* Add Worker Dialog */}
        <WorkerDialog 
          open={workerDialogOpen}
          onOpenChange={setWorkerDialogOpen}
          onSave={fetchWorkers}
        />

        <PhotoModal
          isOpen={photoModal.isOpen}
          onClose={() => setPhotoModal(prev => ({ ...prev, isOpen: false }))}
          photoUrl={photoModal.photoUrl}
          workerName={photoModal.workerName}
          timestamp={photoModal.timestamp}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, worker: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Worker</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteDialog.worker?.name}</strong>? 
                This action cannot be undone and will permanently remove the worker and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog.worker && deleteWorker(deleteDialog.worker)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Worker
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Capacity Limit Dialog */}
      <CapacityLimitDialog
        open={capacityLimitDialog.open}
        onClose={() => setCapacityLimitDialog({ ...capacityLimitDialog, open: false })}
        type={capacityLimitDialog.type}
        planName={capacityLimitDialog.planName}
        currentCount={capacityLimitDialog.currentCount}
        maxAllowed={capacityLimitDialog.maxAllowed}
        plannedCount={capacityLimitDialog.plannedCount}
      />
      </div>
    </Layout>
  );
}