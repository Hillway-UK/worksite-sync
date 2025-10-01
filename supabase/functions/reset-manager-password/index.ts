import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  managerId: string;
  useCustomPassword?: boolean;
  customPassword?: string;
  requirePasswordChange?: boolean;
  sendNotificationEmail?: boolean;
}

// Password policy validation
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function generateSecurePassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const allChars = uppercase + lowercase + numbers + symbols;

  let password = "";
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: "Password must contain uppercase, lowercase, number, and symbol",
    };
  }
  return { valid: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("User authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is super admin
    const { data: superAdmin, error: superAdminError } = await supabaseClient
      .from("super_admins")
      .select("id, email, organization_id")
      .eq("email", user.email)
      .single();

    if (superAdminError || !superAdmin) {
      console.error("Super admin verification failed:", superAdminError);
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ResetPasswordRequest = await req.json();
    const {
      managerId,
      useCustomPassword = false,
      customPassword,
      requirePasswordChange = true,
      sendNotificationEmail = true,
    } = body;

    if (!managerId) {
      return new Response(
        JSON.stringify({ error: "Manager ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get target manager and verify same organization
    const { data: targetManager, error: managerError } = await supabaseAdmin
      .from("managers")
      .select("id, email, name, organization_id, is_super")
      .eq("id", managerId)
      .single();

    if (managerError || !targetManager) {
      console.error("Manager fetch error:", managerError);
      return new Response(
        JSON.stringify({ error: "Manager not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent resetting password for super admin accounts
    if (targetManager.is_super) {
      return new Response(
        JSON.stringify({ error: "Cannot reset password for super admin accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify same organization
    if (targetManager.organization_id !== superAdmin.organization_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate or validate password
    let tempPassword: string;
    if (useCustomPassword && customPassword) {
      const validation = validatePassword(customPassword);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tempPassword = customPassword;
    } else {
      tempPassword = generateSecurePassword();
    }

    // Get user by email to update password
    const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error("Error listing users:", getUserError);
      return new Response(
        JSON.stringify({ error: "Failed to find user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetAuthUser = authUser.users.find(u => u.email === targetManager.email);
    
    if (!targetAuthUser) {
      return new Response(
        JSON.stringify({ error: "User account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password using service role
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthUser.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update manager record
    const { error: updateManagerError } = await supabaseAdmin
      .from("managers")
      .update({
        must_change_password: requirePasswordChange,
        temporary_password_created_at: new Date().toISOString(),
        password_reset_count: targetManager.password_reset_count + 1,
      })
      .eq("id", managerId);

    if (updateManagerError) {
      console.error("Manager update error:", updateManagerError);
    }

    // Create audit log
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: superAdmin.id,
      target_id: managerId,
      action: "manager_password_reset",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        target_email: targetManager.email,
        require_password_change: requirePasswordChange,
        custom_password: useCustomPassword,
      },
    });

    if (auditError) {
      console.error("Audit log error:", auditError);
    }

    // Send notification email if requested
    if (sendNotificationEmail) {
      try {
        await resend.emails.send({
          from: "AutoTime <onboarding@resend.dev>",
          to: [targetManager.email],
          subject: "Your Manager Account Temporary Password",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Temporary Password Reset</h1>
              <p>Hello ${targetManager.name},</p>
              <p>Your manager account password has been reset by a system administrator.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Temporary Password:</strong></p>
                <p style="font-size: 18px; font-family: monospace; background: white; padding: 10px; border-radius: 4px; margin: 0;">
                  ${tempPassword}
                </p>
              </div>

              <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">Important Instructions:</h3>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>Login with this temporary password</li>
                  <li>You will be required to set a new password immediately</li>
                  <li>Your new password must meet these requirements:
                    <ul>
                      <li>At least 8 characters long</li>
                      <li>Contains at least one uppercase letter</li>
                      <li>Contains at least one lowercase letter</li>
                      <li>Contains at least one number</li>
                      <li>Contains at least one special character</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24;"><strong>Security Reminder:</strong></p>
                <p style="margin: 10px 0 0 0; color: #721c24;">
                  Never share your password with anyone. Our team will never ask for your password.
                </p>
              </div>

              <p style="color: #666; font-size: 14px;">
                If you did not expect this password reset, please contact your system administrator immediately.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        temporaryPassword: tempPassword,
        message: `Temporary password created for ${targetManager.name}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-manager-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
