import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationPayload {
  type: "worker" | "manager";
  recipientEmail: string;
  recipientName: string;
  password: string;
  organizationName?: string;
  loginUrl: string;
}

const generateWorkerEmailHTML = (
  name: string,
  email: string,
  password: string,
  organizationName: string,
  loginUrl: string,
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TimeTrack</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background-color: #000000; padding: 28px 32px; text-align: center;">
              <div style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">TimeTrack</div>
              <div style="color: rgba(255,255,255,0.8); font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Workforce Management</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px;">
              <h1 style="color: #111111; font-size: 22px; margin: 0 0 16px 0; font-weight: 600;">
                Welcome to TimeTrack!
              </h1>
              <p style="color: #595959; font-size: 16px; line-height: 1.6; margin: 0 0 18px 0;">
                Hi <strong style="color: #111111;">${name}</strong>,
              </p>
              <p style="color: #595959; font-size: 16px; line-height: 1.6; margin: 0 0 22px 0;">
                Your account has been created for <strong style="color: #111111;">${organizationName}</strong>. Use the credentials below to access your timesheet portal.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f7f7f7; border-radius: 8px; border-left: 4px solid #000000; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #000000; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
                      Your Login Credentials
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #595959; font-size: 14px;">Email:</span>
                        </td>
                        <td style="padding: 6px 0 6px 16px;">
                          <span style="color: #111111; font-size: 14px; font-weight: 600;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #595959; font-size: 14px;">Password:</span>
                        </td>
                        <td style="padding: 6px 0 6px 16px;">
                          <span style="color: #111111; font-size: 14px; font-weight: 600; font-family: monospace; background-color: #ffffff; padding: 4px 8px; border-radius: 4px;">${password}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                      Open TimeTrack App
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #7a7a7a; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
                Security tip: Please change your password after your first login.
              </p>
              <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 0;">
                If you have any questions, please contact your manager.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 32px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999999; font-size: 12px; margin: 0 0 6px 0;">
                Copyright ${new Date().getFullYear()} TimeTrack
              </p>
              <p style="color: #111111; font-size: 12px; margin: 0; font-weight: 500;">${organizationName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateManagerEmailHTML = (
  name: string,
  email: string,
  password: string,
  organizationName: string,
  loginUrl: string,
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TimeTrack Manager Portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background-color: #000000; padding: 28px 32px; text-align: center;">
              <div style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">TimeTrack</div>
              <div style="color: rgba(255,255,255,0.8); font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Manager Portal</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px;">
              <h1 style="color: #111111; font-size: 22px; margin: 0 0 16px 0; font-weight: 600;">
                Welcome to TimeTrack, Manager!
              </h1>
              <p style="color: #595959; font-size: 16px; line-height: 1.6; margin: 0 0 18px 0;">
                Hi <strong style="color: #111111;">${name}</strong>,
              </p>
              <p style="color: #595959; font-size: 16px; line-height: 1.6; margin: 0 0 22px 0;">
                Your manager account has been created for <strong style="color: #111111;">${organizationName}</strong>. You now have access to the management portal.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f7f7f7; border-radius: 8px; border-left: 4px solid #000000; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #000000; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
                      Your Login Credentials
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #595959; font-size: 14px;">Email:</span>
                        </td>
                        <td style="padding: 6px 0 6px 16px;">
                          <span style="color: #111111; font-size: 14px; font-weight: 600;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #595959; font-size: 14px;">Password:</span>
                        </td>
                        <td style="padding: 6px 0 6px 16px;">
                          <span style="color: #111111; font-size: 14px; font-weight: 600; font-family: monospace; background-color: #ffffff; padding: 4px 8px; border-radius: 4px;">${password}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #111111; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">
                      As a manager, you can:
                    </p>
                    <ul style="color: #595959; font-size: 14px; margin: 0; padding-left: 18px;">
                      <li>View and manage worker timesheets</li>
                      <li>Approve time additions and overtime</li>
                      <li>Generate payroll and Xero reports</li>
                      <li>Manage jobs and workers</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                      Access Manager Portal
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #7a7a7a; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
                Security tip: Please change your password after your first login.
              </p>
              <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 0;">
                If you have any questions, please contact your administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 32px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999999; font-size: 12px; margin: 0 0 6px 0;">
                Copyright ${new Date().getFullYear()} TimeTrack
              </p>
              <p style="color: #111111; font-size: 12px; margin: 0; font-weight: 500;">${organizationName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured: missing API key");
    }

    const resend = new Resend(resendApiKey);

    const payload: InvitationPayload = await req.json();
    console.log("Sending invitation email to:", payload.recipientEmail, "Type:", payload.type);

    const { type, recipientEmail, recipientName, password, organizationName, loginUrl } = payload;

    // Validate required fields
    if (!recipientEmail || !recipientName || !password || !loginUrl) {
      throw new Error("Missing required fields: recipientEmail, recipientName, password, loginUrl");
    }

    const orgName = organizationName || "Your Organization";

    // Generate HTML based on type
    const htmlContent = type === "manager"
      ? generateManagerEmailHTML(recipientName, recipientEmail, password, orgName, loginUrl)
      : generateWorkerEmailHTML(recipientName, recipientEmail, password, orgName, loginUrl);

    const subject = type === "manager"
      ? `Welcome to TimeTrack - Manager Account Created`
      : `Welcome to TimeTrack - Your Account is Ready`;

    // Send email via Resend API
    const { data, error } = await resend.emails.send({
      from: "TimeTrack <no-reply@hillwayco.uk>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log("Invitation email sent successfully to:", recipientEmail, "ID:", data?.id);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation email sent successfully", id: data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
