import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with user's token for regular operations
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Current password and new password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate new password requirements
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'New password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'New password must contain uppercase and lowercase letters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'New password must contain at least one number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is a manager
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id, email, must_change_password')
      .eq('email', user.email)
      .single();

    if (managerError || !manager) {
      console.error('Manager verification failed:', managerError);
      return new Response(
        JSON.stringify({ error: 'Access denied. Only managers can change passwords through this endpoint.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Password change request for manager: ${manager.email}`);

    // Re-authenticate with current password to verify it's correct
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      console.error('Current password verification failed:', signInError.message);
      return new Response(
        JSON.stringify({ error: 'Current password is incorrect' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Current password verified successfully');

    // Update the password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update failed:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully');

    // Clear the must_change_password flag if it was set
    if (manager.must_change_password) {
      const { error: flagError } = await supabase
        .from('managers')
        .update({ must_change_password: false })
        .eq('id', manager.id);

      if (flagError) {
        console.error('Failed to clear must_change_password flag:', flagError);
      } else {
        console.log('must_change_password flag cleared');
      }
    }

    // Log the password change event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        target_id: user.id,
        action: 'password_changed',
        metadata: {
          forced: manager.must_change_password || false,
          timestamp: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password changed successfully',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in manager-change-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
