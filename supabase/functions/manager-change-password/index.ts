import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Validate environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    console.log("Received request:", req.method, req.url);

    if (req.method !== "POST") {
      console.log("Method not allowed:", req.method);
      return new Response(
        JSON.stringify({ error: "Method not allowed" }), 
        { status: 405, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid bearer token");
      return new Response(
        JSON.stringify({ error: "Missing bearer token" }), 
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Invalid JSON body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }), 
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { newPassword } = body ?? {};
    if (!newPassword || typeof newPassword !== "string") {
      console.log("Missing newPassword in request body");
      return new Response(
        JSON.stringify({ error: "newPassword is required" }), 
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Identify caller from the provided access token
    if (!SUPABASE_URL || !ANON_KEY) {
      console.error("Missing SUPABASE_URL or ANON_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }), 
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    
    console.log("Verifying user token...");
    const { data: userData, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      console.error("User verification failed:", getUserErr);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("User verified:", userData.user.id);

    // Update password and clear the mandatory-change flag with service role
    if (!SERVICE_ROLE_KEY) {
      console.error("Missing SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }), 
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    console.log("Updating password for user:", userData.user.id);
    
    const { error: updErr } = await admin.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
      user_metadata: { must_change_password: false },
    });
    
    if (updErr) {
      console.error("Password update failed:", updErr);
      return new Response(
        JSON.stringify({ error: updErr.message }), 
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("Password updated successfully");
    return new Response(
      JSON.stringify({ ok: true }), 
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }), 
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
