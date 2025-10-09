import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  worker_id: string;
  amendment_id: string;
  status: 'approved' | 'rejected';
  manager_name: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  manager_notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log('[AMENDMENT-NOTIFICATION] Processing:', payload);

    // Get worker details
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('name, email')
      .eq('id', payload.worker_id)
      .single();

    if (workerError || !worker) {
      throw new Error('Worker not found');
    }

    // Get notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_token')
      .eq('worker_id', payload.worker_id)
      .single();

    // Format notification message
    const isApproved = payload.status === 'approved';
    const title = isApproved 
      ? '✅ Time Amendment Approved' 
      : '❌ Time Amendment Rejected';
    
    let body = `Your time amendment request was ${payload.status} by ${payload.manager_name}.`;
    
    if (isApproved && (payload.requested_clock_in || payload.requested_clock_out)) {
      body += '\n\nYour clock entry has been updated:';
      if (payload.requested_clock_in) {
        const clockInTime = new Date(payload.requested_clock_in).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        body += `\n• Clock In: ${clockInTime}`;
      }
      if (payload.requested_clock_out) {
        const clockOutTime = new Date(payload.requested_clock_out).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        body += `\n• Clock Out: ${clockOutTime}`;
      }
    }

    if (payload.manager_notes) {
      body += `\n\nManager notes: ${payload.manager_notes}`;
    }

    // Create in-app notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        worker_id: payload.worker_id,
        type: 'amendment_' + payload.status,
        title,
        body,
        dedupe_key: `amendment_${payload.amendment_id}_${payload.status}`,
      });

    if (notifError) {
      console.error('[AMENDMENT-NOTIFICATION] Failed to create in-app notification:', notifError);
      throw notifError;
    }

    console.log('[AMENDMENT-NOTIFICATION] In-app notification created');

    // Send push notification if token exists (placeholder for push service integration)
    if (prefs?.push_token) {
      try {
        // TODO: Integrate with Firebase Cloud Messaging (FCM) or Expo Push here
        console.log('[AMENDMENT-NOTIFICATION] Push notification would be sent to:', prefs.push_token);
      } catch (pushError) {
        console.error('[AMENDMENT-NOTIFICATION] Push notification failed:', pushError);
        // Don't throw - in-app notification is more important
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AMENDMENT-NOTIFICATION] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});