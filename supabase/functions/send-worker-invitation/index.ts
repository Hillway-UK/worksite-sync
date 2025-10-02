import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkerInvitationRequest {
  email: string;
  fullName: string;
  orgName: string;
  tempPassword: string;
  issuedAt: string;
  __dryRun?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Parse request body
    const { email, fullName, orgName, tempPassword, issuedAt, __dryRun }: WorkerInvitationRequest = await req.json();

    console.log("Processing worker invitation for:", email);
    console.log("Dry run mode:", __dryRun ? "enabled" : "disabled");

    // Create Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user already exists to determine link type
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    const linkType = existingUser ? 'invite' : 'signup';
    
    console.log(`Generating Supabase confirmation link (${linkType}) for:`, email);
    
    // Generate Supabase confirmation link with redirectTo
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType,
      email,
      options: {
        redirectTo: 'https://autotimeworkers.hillwayco.uk/'
      }
    });

    if (linkError) {
      console.error("Failed to generate confirmation link:", linkError);
      throw new Error(`Failed to generate confirmation link: ${linkError.message}`);
    }

    console.log("Link data received:", JSON.stringify(linkData, null, 2));

    // Check both possible paths for action_link (SDK version compatibility)
    const actionLink = linkData?.properties?.action_link || linkData?.action_link;

    if (!actionLink) {
      console.error("No action link found in response. Full data:", JSON.stringify(linkData, null, 2));
      throw new Error("No confirmation link generated");
    }

    console.log("Generated confirmation link successfully:", actionLink);

    // Build production wrapper URL
    const loginHref = `https://autotime.hillwayco.uk/auth/confirm?confirmation_url=${encodeURIComponent(actionLink)}`;

    // If dry run, return early without sending email
    if (__dryRun) {
      console.log("Dry run mode - skipping email send");
      return new Response(
        JSON.stringify({
          ok: true,
          dryRun: true,
          loginHref,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Format timestamp for display
    const formattedTime = new Date(issuedAt).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    // HTML email template
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm AutoTime Sign up</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background-color:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin:0 0 8px;color:#111111;font-size:24px;font-weight:600;">Confirm your sign up to AutoTime</h2>
      
      <p style="margin:16px 0;color:#333333;font-size:16px;line-height:1.5;">Hello ${fullName},</p>
      
      <p style="margin:16px 0;color:#333333;font-size:16px;line-height:1.5;">Your manager added you to ${orgName} AutoTime. Please confirm your sign up.</p>
      
      <p style="margin:16px 0;color:#333333;font-size:16px;line-height:1.5;"><strong>Time:</strong> ${formattedTime}</p>
      
      <p style="margin:16px 0;color:#333333;font-size:16px;line-height:1.5;"><strong>Temporary Password:</strong></p>
      <div style="background-color:#f8f9fa;border:2px solid #702D30;border-radius:6px;padding:16px;margin:12px 0;text-align:center;">
        <code style="font-size:20px;font-weight:600;color:#702D30;letter-spacing:1px;">${tempPassword}</code>
      </div>
      
      <div style="background-color:#fff8e1;border:1px solid:#ffe08a;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#856404;font-size:14px;line-height:1.5;">⚠️ <strong>Please do not share this temporary password with anyone for your account security, and please update your password on your first login.</strong></p>
      </div>
      
      <p style="margin:24px 0;color:#333333;font-size:16px;line-height:1.5;">You can log in here:</p>
      
      <div style="text-align:center;margin:24px 0;">
        <a href="${loginHref}" style="display:inline-block;background-color:#702D30;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;">Login</a>
      </div>
      
      <p style="margin:32px 0 0;color:#333333;font-size:16px;line-height:1.5;">Best regards,<br/>AutoTime Team</p>
    </div>
    
    <p style="text-align:center;color:#666666;font-size:12px;margin-top:24px;">This is an automated message from AutoTime. Please do not reply to this email.</p>
  </div>
</body>
</html>
`;

    // Plain text email template
    const textBody = `Confirm your sign up to AutoTime

Hello ${fullName},

Your manager added you to ${orgName} AutoTime. Please confirm your sign up.

Time: ${formattedTime}

Temporary Password: ${tempPassword}

⚠️ Please do not share this temporary password with anyone for your account security, and please update your password on your first login.

You can log in here: ${loginHref}

Best regards,
AutoTime Team

---
This is an automated message from AutoTime. Please do not reply to this email.`;

    // Send email via Resend
    console.log("Sending email via Resend to:", email);
    console.log("Login href in email:", loginHref);
    
    const emailPayload = {
      from: "AutoTime <no-reply@hillwayco.uk>",
      to: [email],
      subject: "Confirm AutoTime Sign up",
      html: htmlBody,
      text: textBody,
    };
    
    console.log("Resend API request payload:", JSON.stringify({ ...emailPayload, html: '[HTML content]', text: '[Text content]' }));
    
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    console.log("Resend API response status:", resendResponse.status);
    
    const responseText = await resendResponse.text();
    console.log("Resend API raw response:", responseText);

    if (!resendResponse.ok) {
      console.error("Resend API error - Status:", resendResponse.status);
      console.error("Resend API error - Body:", responseText);
      throw new Error(`Resend API error: ${resendResponse.status} - ${responseText}`);
    }

    const resendData = JSON.parse(responseText);
    console.log("Email sent successfully! Email ID:", resendData.id);

    return new Response(
      JSON.stringify({
        ok: true,
        id: resendData.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-worker-invitation function:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "Failed to send worker invitation email",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
