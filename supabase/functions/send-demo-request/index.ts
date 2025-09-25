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

    // Log successful demo request submission
    logStep("Demo request processed successfully (email notification disabled)");

    return new Response(JSON.stringify({ 
      message: 'Demo request received successfully!' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
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