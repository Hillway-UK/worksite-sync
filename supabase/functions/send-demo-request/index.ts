import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-DEMO-REQUEST] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Rate limiting: Track requests by IP (simplified approach)
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    logStep("Processing request from IP", { ip: clientIP });
    
    // Use service role key to bypass RLS for inserting demo requests
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { name, email, company, phone, message, admin_users = 1, worker_count = 0, monthly_cost, honeypot } = await req.json();
    logStep("Request data parsed", { name, email, company, phone });

    // Security checks
    if (!name || !email || !company) {
      throw new Error("Name, email, and company are required");
    }

    // Honeypot field check (should be empty)
    if (honeypot && honeypot.trim() !== '') {
      logStep("Bot detected via honeypot", { honeypot });
      throw new Error("Invalid request");
    }

    // Input validation and sanitization
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 255);
    const sanitizedCompany = company.trim().substring(0, 100);
    const sanitizedPhone = phone ? phone.trim().substring(0, 20) : null;
    const sanitizedMessage = message ? message.trim().substring(0, 1000) : null;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      throw new Error("Invalid email format");
    }

    // Check for suspicious patterns (basic spam detection)
    const suspiciousPatterns = [
      /viagra|cialis|casino|poker|loan|crypto|bitcoin/i,
      /win\s*\$|free\s*money|click\s*here/i,
      /http[s]?:\/\//i // URLs in name/company fields
    ];
    
    const textToCheck = `${sanitizedName} ${sanitizedCompany} ${sanitizedMessage || ''}`;
    if (suspiciousPatterns.some(pattern => pattern.test(textToCheck))) {
      logStep("Suspicious content detected", { content: textToCheck.substring(0, 100) });
      throw new Error("Invalid request content");
    }

    // Store demo request in database
    const { error: insertError } = await supabaseClient
      .from('demo_requests')
      .insert({
        name: sanitizedName,
        email: sanitizedEmail,
        company: sanitizedCompany,
        phone: sanitizedPhone,
        message: sanitizedMessage,
        admin_users,
        worker_count,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (insertError) throw insertError;
    logStep("Demo request stored in database");

    // Send email notification using Supabase's email service
    try {
      const { error: emailError } = await supabaseClient.auth.admin.sendRawEmail({
        to: 'hello@hillwayco.uk',
        subject: `New Demo Request - ${sanitizedCompany}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #702D30; border-bottom: 2px solid #702D30; padding-bottom: 10px;">
              New Demo Request Received
            </h2>
            
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Contact Information</h3>
              <p><strong>Name:</strong> ${sanitizedName}</p>
              <p><strong>Email:</strong> <a href="mailto:${sanitizedEmail}">${sanitizedEmail}</a></p>
              <p><strong>Company:</strong> ${sanitizedCompany}</p>
              ${sanitizedPhone ? `<p><strong>Phone:</strong> <a href="tel:${sanitizedPhone}">${sanitizedPhone}</a></p>` : ''}
            </div>

            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Requirements & Pricing</h3>
              <p><strong>Admin Users:</strong> ${admin_users} (£${admin_users * 25}/month)</p>
              <p><strong>Workers:</strong> ${worker_count} (£${(worker_count * 1.5).toFixed(2)}/month)</p>
              <p><strong>Total Monthly Cost:</strong> <span style="color: #702D30; font-size: 1.2em; font-weight: bold;">£${monthly_cost || (admin_users * 25 + worker_count * 1.5).toFixed(2)} + VAT</span></p>
            </div>

            ${sanitizedMessage ? `
              <div style="background-color: #fff; padding: 20px; border-left: 4px solid #702D30; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Additional Message</h3>
                <p style="line-height: 1.6;">${sanitizedMessage}</p>
              </div>
            ` : ''}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              <p>This email was automatically generated from the Pioneer Auto Timesheets demo request form.</p>
              <p><strong>Action Required:</strong> Please follow up with this prospect within 24 hours.</p>
            </div>
          </div>
        `
      });

      if (emailError) {
        logStep("Email sending failed", { error: emailError.message });
        // Don't throw here - we still want to return success since the demo request was saved
        console.error("Failed to send email notification:", emailError);
      } else {
        logStep("Email sent successfully to hello@hillwayco.uk");
      }
    } catch (emailError) {
      logStep("Email service error", { error: emailError });
      // Continue - email failure shouldn't fail the whole request
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Demo request submitted successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-demo-request", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});