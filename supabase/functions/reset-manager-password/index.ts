import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  managerId: string;
  password?: string;
  requirePasswordChange: boolean;
  sendEmail: boolean;
}

const generateSecurePassword = (): string => {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is a superadmin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from("super_admins")
      .select("id, organization_id")
      .eq("email", user.email)
      .single();

    if (superAdminError || !superAdmin) {
      console.error("Superadmin verification failed:", superAdminError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Superadmin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { managerId, password, requirePasswordChange, sendEmail }: ResetPasswordRequest = await req.json();

    // Get manager details
    const { data: manager, error: managerError } = await supabase
      .from("managers")
      .select("id, email, name, organization_id")
      .eq("id", managerId)
      .single();

    if (managerError || !manager) {
      console.error("Manager not found:", managerError);
      return new Response(
        JSON.stringify({ error: "Manager not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent targeting superadmin accounts
    const { data: targetIsSuperAdmin } = await supabase
      .from("super_admins")
      .select("id")
      .eq("email", manager.email)
      .single();

    if (targetIsSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Cannot reset password for superadmin accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate or use provided password
    const tempPassword = password || generateSecurePassword();

    // Get the user's auth ID
    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error("Failed to list users:", authUsersError);
      throw authUsersError;
    }

    const authUser = authUsers.users.find(u => u.email === manager.email);
    
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Manager auth account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw updateError;
    }

    // Update must_change_password flag
    if (requirePasswordChange) {
      const { error: managerUpdateError } = await supabase
        .from("managers")
        .update({ must_change_password: true })
        .eq("id", managerId);

      if (managerUpdateError) {
        console.error("Failed to update manager:", managerUpdateError);
      }
    }

    // Create audit log
    const userAgent = req.headers.get("user-agent") || "unknown";
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      target_id: managerId,
      action: "manager_password_reset",
      metadata: {
        manager_email: manager.email,
        manager_name: manager.name,
        require_password_change: requirePasswordChange,
      },
      ip_address: clientIp,
      user_agent: userAgent,
    });

    // Send email notification if requested
    if (sendEmail) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const siteUrl = Deno.env.get('SITE_URL') || 'https://kejblmetyrsehzvrxgmt.lovable.app';
        const loginUrl = `${siteUrl}/login`;
        
        await resend.emails.send({
          from: "AutoTime <no-reply@hillwayco.uk>",
          to: [manager.email],
          subject: "Your Manager Account Password Was Reset",
          html: `
            <h2>Password Reset Notification</h2>
            <p>Hello ${manager.name},</p>
            <p>Your manager account password was reset by a system administrator.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p>⚠️ Please do not share this temporary password with anyone for your account security.</p>
            <p>You can log in here: <a href="${loginUrl}">${loginUrl}</a></p>
            ${requirePasswordChange ? '<p><strong>Action Required:</strong> You will be required to change your password when you log in.</p>' : ''}
            <p>If you did not request this change, please contact your system administrator immediately.</p>
            <p>Best regards,<br>AutoTime Team</p>
          `,
        });
      }
    }

    console.log(`Password reset successful for manager ${manager.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        tempPassword: tempPassword,
        message: `Temporary password created for ${manager.name}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-manager-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
