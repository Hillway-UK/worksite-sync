import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Payload = {
  name: string;
  email: string;
  company: string;
  phone?: string;
  message?: string;
  admin_users?: number;
  worker_count?: number;
  monthly_cost?: string;
  honeypot?: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Demo Requests <noreply@hillwayco.uk>";
const TO_EMAIL = Deno.env.get("TO_EMAIL") ?? "mira@hillwayco.uk";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details, (key, val) => {
    // Redact sensitive fields from logs
    if (key === 'email' || key === 'phone') return '[REDACTED]';
    return val;
  })}` : '';
  console.log(`[SEND-DEMO-REQUEST] ${step}${detailsStr}`);
};

function corsHeaders(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function badRequest(msg: string, origin: string | null) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}

function validate(p: any): { ok: true; data: Payload } | { ok: false; err: string } {
  if (!p || typeof p !== "object") return { ok: false, err: "Invalid JSON body" };
  
  const trim = (s: unknown) => typeof s === "string" ? s.trim() : "";
  
  const name = trim(p.name);
  const email = trim(p.email).toLowerCase();
  const company = trim(p.company);
  const phone = trim(p.phone ?? "");
  const message = trim(p.message ?? "");
  const honeypot = trim(p.honeypot ?? "");
  const admin_users = typeof p.admin_users === "number" ? p.admin_users : 1;
  const worker_count = typeof p.worker_count === "number" ? p.worker_count : 0;
  const monthly_cost = trim(p.monthly_cost ?? "");

  // Honeypot check
  if (honeypot) return { ok: false, err: "Bot detected" };
  
  // Required fields
  if (!name || name.length < 2 || name.length > 100) {
    return { ok: false, err: "Name must be between 2 and 100 characters" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { ok: false, err: "Invalid email format" };
  }
  if (!company || company.length < 2 || company.length > 200) {
    return { ok: false, err: "Company must be between 2 and 200 characters" };
  }
  
  // Optional phone validation
  if (phone && !/^[\d\s\-\+\(\)]{7,20}$/.test(phone)) {
    return { ok: false, err: "Invalid phone format" };
  }
  
  // Message length check
  if (message.length > 1000) {
    return { ok: false, err: "Message too long (max 1000 characters)" };
  }

  // Basic spam detection
  const suspiciousPatterns = [
    /viagra|cialis|casino|poker|loan|crypto|bitcoin/i,
    /win\s*\$|free\s*money|click\s*here/i,
    /http[s]?:\/\//i // URLs in name/company fields
  ];
  
  const textToCheck = `${name} ${company} ${message}`;
  if (suspiciousPatterns.some(pattern => pattern.test(textToCheck))) {
    return { ok: false, err: "Suspicious content detected" };
  }

  return {
    ok: true,
    data: { name, email, company, phone, message, admin_users, worker_count, monthly_cost, honeypot: "" }
  };
}

async function sendEmail(payload: Payload) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const subject = `New Demo Request from ${payload.company}`;
  const html = `
    <h2>New Demo Request Received</h2>
    <p><strong>Company:</strong> ${payload.company}</p>
    <p><strong>Contact Name:</strong> ${payload.name}</p>
    <p><strong>Email:</strong> ${payload.email}</p>
    <p><strong>Phone:</strong> ${payload.phone || 'Not provided'}</p>
    <p><strong>Admin Users:</strong> ${payload.admin_users || 1}</p>
    <p><strong>Worker Count:</strong> ${payload.worker_count || 0}</p>
    <p><strong>Estimated Monthly Cost:</strong> ${payload.monthly_cost ? `£${payload.monthly_cost}` : 'Not calculated'}</p>
    ${payload.message ? `<p><strong>Message:</strong><br>${payload.message}</p>` : ''}
    <p><em>Request received at: ${new Date().toISOString()}</em></p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject,
      html,
      reply_to: payload.email,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logStep("Resend API error", { status: res.status, body: body.substring(0, 200) });
    throw new Error(`Email delivery failed (${res.status})`);
  }

  const result = await res.json();
  logStep("Email sent successfully", { id: result.id });
  return result;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    logStep("Function started");

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(origin)
      });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return badRequest("Content-Type must be application/json", origin);
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    logStep("Processing request", { ip: clientIP });

    const body = await req.json();
    const validation = validate(body);
    
    if (!validation.ok) {
      logStep("Validation failed", { error: validation.err });
      return badRequest(validation.err, origin);
    }

    const payload = validation.data;

    // Store in database using service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error: insertError } = await supabaseClient
      .from("demo_requests")
      .insert({
        name: payload.name,
        email: payload.email,
        company: payload.company,
        phone: payload.phone,
        message: payload.message,
        admin_users: payload.admin_users,
        worker_count: payload.worker_count,
        status: "pending",
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      logStep("Database insert failed", { error: insertError.message });
      throw new Error("Failed to store demo request");
    }

    logStep("Demo request stored in database");

    // Send email notification
    await sendEmail(payload);

    return new Response(JSON.stringify({ ok: true, message: "Demo request received successfully!" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: "Failed to send demo request. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});