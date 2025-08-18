import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    
    console.log(`Running clock status check at ${now.toISOString()}, day: ${dayOfWeek}, time: ${currentTime}`);

    // Only run on weekdays (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('Weekend - no notifications sent');
      return new Response(JSON.stringify({ message: 'Weekend - no notifications' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Morning check (9am) - remind workers to clock in
    if (currentTime === '09:00') {
      console.log('Running morning check for clock-in reminders');
      
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true);

      if (workersError) {
        console.error('Error fetching workers:', workersError);
        throw workersError;
      }

      for (const worker of workers || []) {
        // Check if worker has clocked in today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { data: todayEntry, error: entryError } = await supabase
          .from('clock_entries')
          .select('*')
          .eq('worker_id', worker.id)
          .gte('clock_in', todayStart.toISOString())
          .maybeSingle();

        if (entryError) {
          console.error(`Error checking entry for worker ${worker.id}:`, entryError);
          continue;
        }

        if (!todayEntry) {
          console.log(`Sending clock-in reminder to worker ${worker.name}`);
          await sendNotificationToWorker(worker.id, 
            'Clock In Reminder', 
            'Good morning! Don\'t forget to clock in for today.');
        }
      }
    }

    // Evening check (7pm) - remind workers to clock out
    if (currentTime === '19:00') {
      console.log('Running evening check for clock-out reminders');
      
      const { data: activeEntries, error: activeError } = await supabase
        .from('clock_entries')
        .select('*, workers(*)')
        .is('clock_out', null);

      if (activeError) {
        console.error('Error fetching active entries:', activeError);
        throw activeError;
      }

      for (const entry of activeEntries || []) {
        console.log(`Sending clock-out reminder to worker ${entry.workers.name}`);
        await sendNotificationToWorker(entry.worker_id,
          'Clock Out Reminder',
          'You\'re still clocked in. Don\'t forget to clock out!');
      }
    }

    // Auto clock-out check (run every hour)
    console.log('Running auto clock-out check');
    const { error: autoClockoutError } = await supabase.rpc('auto_clock_out_after_12_hours');
    
    if (autoClockoutError) {
      console.error('Error running auto clock-out:', autoClockoutError);
    } else {
      console.log('Auto clock-out check completed successfully');
    }

    return new Response(JSON.stringify({ 
      message: 'Clock status checks completed successfully',
      timestamp: now.toISOString(),
      dayOfWeek,
      currentTime
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in check-clock-status function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendNotificationToWorker(workerId: string, title: string, body: string) {
  // This is a placeholder for sending push notifications
  // In a real implementation, you would fetch the worker's push token
  // and send the notification using a service like FCM or Web Push
  console.log(`Notification to worker ${workerId}: ${title} - ${body}`);
  
  // For now, we'll just log the notification
  // In production, integrate with your preferred push notification service
}