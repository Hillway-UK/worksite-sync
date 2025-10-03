import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, organizationId } = await req.json();

    if (!email || !name || !organizationId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: email, name, organizationId" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`[invite-worker] Attempting to invite worker: ${email}`);

    // Try to invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: 'https://autotimeworkers.hillwayco.uk/reset-password?source=invite',
        data: {
          name,
          role: 'worker',
          organization_id: organizationId,
        },
      }
    );

    // Handle "user already exists" error - fall back to password reset
    if (inviteError) {
      console.log(`[invite-worker] Invite error: ${inviteError.message}`);
      
      // Check for various "user already exists" error messages
      if (
        inviteError.message.includes('already registered') ||
        inviteError.message.includes('already been registered') ||
        inviteError.message.includes('User already registered') ||
        inviteError.status === 422
      ) {
        console.log(`[invite-worker] User exists, sending password reset instead`);
        
        // Send password reset email
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: 'https://autotimeworkers.hillwayco.uk/reset-password?source=reset',
          }
        );

        if (resetError) {
          console.error(`[invite-worker] Reset email error: ${resetError.message}`);
          throw new Error(`Failed to send reset email: ${resetError.message}`);
        }

        console.log(`[invite-worker] Reset email sent successfully to ${email}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Reset email sent',
            type: 'reset',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // If it's a different error, throw it
      throw inviteError;
    }

    console.log(`[invite-worker] Invitation sent successfully to ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invite sent',
        type: 'invite',
        userId: inviteData?.user?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[invite-worker] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
