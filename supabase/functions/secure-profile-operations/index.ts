import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ProfileUpdateRequest {
  action: 'update_profile' | 'change_password' | 'upload_photo';
  data: {
    name?: string;
    email?: string;
    newPassword?: string;
    confirmPassword?: string;
    photoData?: string;
    photoFileName?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for secure operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the JWT from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { action, data }: ProfileUpdateRequest = await req.json();

    // Validate required fields
    if (!action || !data) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get worker record
    const { data: worker, error: workerError } = await supabaseAdmin
      .from('workers')
      .select('*')
      .eq('email', user.email)
      .single();

    if (workerError || !worker) {
      console.error('Worker not found:', workerError);
      return new Response(
        JSON.stringify({ error: 'Worker profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log security event
    console.log(`Profile operation: ${action} for user ${user.id}`);

    switch (action) {
      case 'update_profile':
        return await handleProfileUpdate(supabaseAdmin, user, worker, data);
      
      case 'change_password':
        return await handlePasswordChange(supabaseAdmin, user, data);
      
      case 'upload_photo':
        return await handlePhotoUpload(supabaseAdmin, worker, data);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Secure profile operation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleProfileUpdate(supabaseAdmin: any, user: any, worker: any, data: any) {
  try {
    // Validate and sanitize input
    const updates: any = {};
    
    if (data.name) {
      if (typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Name must be between 2 and 100 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.name = data.name.trim();
    }

    if (data.email && data.email !== user.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update auth email first
      const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { email: data.email }
      );

      if (authEmailError) {
        console.error('Auth email update failed:', authEmailError);
        return new Response(
          JSON.stringify({ error: 'Failed to update email in authentication system' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      updates.email = data.email.toLowerCase().trim();
    }

    // Update worker record
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('workers')
        .update(updates)
        .eq('id', worker.id);

      if (updateError) {
        console.error('Worker update failed:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log successful update
    console.log(`Profile updated successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: data.email && data.email !== user.email 
          ? 'Profile updated! Please verify your new email address.' 
          : 'Profile updated successfully!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Profile update error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handlePasswordChange(supabaseAdmin: any, user: any, data: any) {
  try {
    // Validate password
    if (!data.newPassword || data.newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'New password must be at least 8 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.newPassword !== data.confirmPassword) {
      return new Response(
        JSON.stringify({ error: 'Passwords do not match' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password using admin API
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: data.newPassword }
    );

    if (passwordError) {
      console.error('Password update failed:', passwordError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful password change (without logging the password)
    console.log(`Password changed successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Password changed successfully!' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Password change error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to change password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handlePhotoUpload(supabaseAdmin: any, worker: any, data: any) {
  try {
    if (!data.photoData || !data.photoFileName) {
      return new Response(
        JSON.stringify({ error: 'Photo data and filename required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const allowedTypes = ['jpg', 'jpeg', 'png', 'webp'];
    const fileExt = data.photoFileName.split('.').pop()?.toLowerCase();
    
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only JPG, PNG, and WebP allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 to blob
    const photoBuffer = Uint8Array.from(atob(data.photoData), c => c.charCodeAt(0));
    
    // Validate file size (max 5MB)
    if (photoBuffer.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 5MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = `${worker.id}-${Date.now()}.${fileExt}`;
    const filePath = `worker-photos/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('worker-photos')
      .upload(filePath, photoBuffer, {
        contentType: `image/${fileExt}`,
        upsert: true
      });

    if (uploadError) {
      console.error('Photo upload failed:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload photo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('worker-photos')
      .getPublicUrl(filePath);

    // Update worker record
    const { error: updateError } = await supabaseAdmin
      .from('workers')
      .update({ photo_url: publicUrl })
      .eq('id', worker.id);

    if (updateError) {
      console.error('Photo URL update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile photo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Photo uploaded successfully for worker ${worker.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Photo uploaded successfully!',
        photoUrl: publicUrl
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Photo upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload photo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}