import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Missing bearer token" }, { status: 401, headers: CORS });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
    }

    const { newPassword } = body ?? {};
    if (!newPassword || typeof newPassword !== "string") {
      return Response.json({ error: "newPassword is required" }, { status: 400, headers: CORS });
    }

    // Identify caller from the provided access token
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    // Update password and clear the mandatory-change flag with service role
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: updErr } = await admin.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
      user_metadata: { must_change_password: false },
    });
    if (updErr) {
      return Response.json({ error: updErr.message }, { status: 500, headers: CORS });
    }

    return Response.json({ ok: true }, { status: 200, headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
