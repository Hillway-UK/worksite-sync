import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, FileText, LogOut, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationService } from '@/services/notifications';
import { toast } from 'sonner';

const localizer = momentLocalizer(moment);

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
  job?: {
    name: string;
    code: string;
  };
  amendments?: {
    status: string;
  }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ClockEntry;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetchWorker();
  }, [user]);

  useEffect(() => {
    if (worker) {
      fetchClockEntries();
      setupNotifications();
    }
  }, [worker]);

  const fetchWorker = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      setWorker(data);
    } catch (error) {
      console.error('Error fetching worker:', error);
    }
  };

  const fetchClockEntries = async () => {
    if (!worker?.id) return;

    try {
      const { data: entries } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs:job_id(name, code),
          time_amendments(status)
        `)
        .eq('worker_id', worker.id)
        .order('clock_in', { ascending: false });

      setClockEntries(entries || []);
    } catch (error) {
      console.error('Error fetching clock entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupNotifications = async () => {
    try {
      const permission = await NotificationService.requestPermission();
      if (permission && worker?.id) {
        const subscription = await NotificationService.subscribeToPushNotifications(worker.id);
        setNotificationsEnabled(!!subscription);
        
        if (subscription) {
          toast.success('Notifications enabled successfully');
          
          // Show a test notification
          NotificationService.showLocalNotification(
            'Pioneer Timesheets',
            'Notifications are now enabled! You\'ll receive reminders for clock-in and clock-out.'
          );
        }
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const getEventColor = (entry: ClockEntry) => {
    if (entry.amendments?.some(a => a.status === 'pending')) {
      return '#fbbf24'; // yellow
    }
    if (entry.amendments?.some(a => a.status === 'approved')) {
      return '#10b981'; // green
    }
    return '#3b82f6'; // blue (normal)
  };

  const events: CalendarEvent[] = clockEntries.map(entry => {
    const start = new Date(entry.clock_in);
    const end = entry.clock_out ? new Date(entry.clock_out) : new Date(start.getTime() + 8 * 60 * 60 * 1000);

    return {
      id: entry.id,
      title: `${entry.job?.name || 'Unknown Job'} (${entry.total_hours || 'In Progress'}h)`,
      start,
      end,
      resource: entry
    };
  });

  const eventStyleGetter = (event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: getEventColor(event.resource),
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        fontSize: '12px'
      }
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading calendar...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Time Calendar</h1>
            <p className="text-muted-foreground">View your clock entries and request amendments</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Notification Status */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted mr-4">
              <Bell className={`h-4 w-4 ${notificationsEnabled ? 'text-green-600' : 'text-gray-400'}`} />
              <span className="text-sm">
                {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
              </span>
            </div>
            
            <Button
              onClick={() => navigate('/profile')}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button
              onClick={() => navigate('/timesheets')}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="mr-2 h-4 w-4" />
              Timesheets
            </Button>
            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login');
              }}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4 mb-6">
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Normal Entry</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Approved Amendment</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Pending Amendment</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border overflow-hidden" style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day']}
            defaultView="month"
            popup
            className="p-4"
          />
        </div>

        {selectedEvent && (
          <Dialog open={true} onOpenChange={() => setSelectedEvent(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Clock Entry Details</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Job</h3>
                  <p className="text-muted-foreground">
                    {selectedEvent.resource.job?.name} ({selectedEvent.resource.job?.code})
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Clock In</h3>
                  <p className="text-muted-foreground">
                    {moment(selectedEvent.resource.clock_in).format('MMM D, YYYY h:mm A')}
                  </p>
                </div>
                {selectedEvent.resource.clock_out && (
                  <div>
                    <h3 className="font-semibold text-foreground">Clock Out</h3>
                    <p className="text-muted-foreground">
                      {moment(selectedEvent.resource.clock_out).format('MMM D, YYYY h:mm A')}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground">Total Hours</h3>
                  <p className="text-muted-foreground">
                    {selectedEvent.resource.total_hours || 'In Progress'}
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setSelectedEvent(null);
                    window.location.href = '/amendments';
                  }}
                  className="w-full"
                >
                  Request Amendment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}