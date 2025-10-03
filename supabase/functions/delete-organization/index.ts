// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** HTTP helpers with CORS */
function json(body: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

const bad = (b: Record<string, any>) => json(b, 400);
const forbid = (b: Record<string, any> = { error: "Forbidden" }) => json(b, 403);
const oops = (b: Record<string, any> = { error: "Unexpected error" }) => json(b, 500);

/** Service-role client for privileged operations */
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

/** Client using caller token for reading user */
function getAuthedClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return bad({ error: "Method not allowed. Use POST." });
    }

    // Parse and normalize input - accept multiple key names
    const raw = await req.json().catch(() => ({}));
    const organization_id = raw.organization_id ?? raw.organizationId ?? raw.id ?? "";

    // Validate input
    if (!organization_id || typeof organization_id !== "string" || organization_id.trim() === "") {
      return bad({ error: "organization_id is required and must be a non-empty string" });
    }

    console.log(`[DELETE-ORGANIZATION] Request to delete: ${organization_id}`);

    // --- Authentication: Get user from JWT ---
    const authed = getAuthedClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();

    if (userError || !userData?.user) {
      console.error("[DELETE-ORGANIZATION] Auth failed:", userError);
      return forbid({ error: "Not authenticated" });
    }

    const user = userData.user;
    console.log(`[DELETE-ORGANIZATION] User: ${user.email}`);

    // --- Authorization: Check for superadmin role ---
    const roleMeta =
      (user.app_metadata as any)?.role ??
      (user.app_metadata as any)?.roles ??
      (user.user_metadata as any)?.role;

    const roles: string[] = Array.isArray(roleMeta)
      ? roleMeta
      : typeof roleMeta === "string"
      ? [roleMeta]
      : [];

    const isSuperadmin =
      roles.includes("superadmin") ||
      roles.includes("super_admin") ||
      (user.app_metadata as any)?.is_superadmin === true ||
      (user.user_metadata as any)?.is_superadmin === true;

    // Also check super_admins table as fallback
    const { data: superAdminRecord } = await admin
      .from("super_admins")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (!isSuperadmin && !superAdminRecord) {
      console.log(`[DELETE-ORGANIZATION] Not authorized: ${user.email}`);
      return forbid({ error: "Superadmin role required" });
    }

    console.log(`[DELETE-ORGANIZATION] Authorization verified for: ${user.email}`);

    // --- Check organization exists ---
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", organization_id)
      .maybeSingle();

    if (orgErr) {
      console.error("[DELETE-ORGANIZATION] Org lookup error:", orgErr);
      return oops({ error: "Failed to lookup organization" });
    }

    if (!org) {
      return bad({ error: "Organization not found" });
    }

    console.log(`[DELETE-ORGANIZATION] Deleting organization: ${org.name}`);

    // --- Cascading deletes in correct order ---

    // 1. Get all worker IDs in this organization
    const { data: workers, error: workersErr } = await admin
      .from("workers")
      .select("id")
      .eq("organization_id", organization_id);

    if (workersErr) {
      console.error("[DELETE-ORGANIZATION] Failed to fetch workers:", workersErr);
      return oops({ error: "Failed to fetch workers" });
    }

    const worker_ids = (workers ?? []).map((w) => w.id);
    const worker_count = worker_ids.length;

    console.log(`[DELETE-ORGANIZATION] Found ${worker_count} workers`);

    // 2. Delete worker-related data
    if (worker_ids.length > 0) {
      // Clock entries
      const { error: ceErr } = await admin
        .from("clock_entries")
        .delete()
        .in("worker_id", worker_ids);
      if (ceErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete clock_entries:", ceErr);
        return oops({ error: `Failed to delete clock entries: ${ceErr.message}` });
      }

      // Time amendments
      const { error: taErr } = await admin
        .from("time_amendments")
        .delete()
        .in("worker_id", worker_ids);
      if (taErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete time_amendments:", taErr);
        return oops({ error: `Failed to delete time amendments: ${taErr.message}` });
      }

      // Additional costs
      const { error: acErr } = await admin
        .from("additional_costs")
        .delete()
        .in("worker_id", worker_ids);
      if (acErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete additional_costs:", acErr);
        return oops({ error: `Failed to delete additional costs: ${acErr.message}` });
      }

      // Notifications
      const { error: notifErr } = await admin
        .from("notifications")
        .delete()
        .in("worker_id", worker_ids);
      if (notifErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notifications:", notifErr);
        return oops({ error: `Failed to delete notifications: ${notifErr.message}` });
      }

      // Notification preferences
      const { error: npErr } = await admin
        .from("notification_preferences")
        .delete()
        .in("worker_id", worker_ids);
      if (npErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notification_preferences:", npErr);
        return oops({ error: `Failed to delete notification preferences: ${npErr.message}` });
      }

      // Notification log
      const { error: nlErr } = await admin
        .from("notification_log")
        .delete()
        .in("worker_id", worker_ids);
      if (nlErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notification_log:", nlErr);
        return oops({ error: `Failed to delete notification log: ${nlErr.message}` });
      }

      // Auto clockout counters
      const { error: accErr } = await admin
        .from("auto_clockout_counters")
        .delete()
        .in("worker_id", worker_ids);
      if (accErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete auto_clockout_counters:", accErr);
        return oops({ error: `Failed to delete auto clockout counters: ${accErr.message}` });
      }

      // Auto clockout audit
      const { error: acaErr } = await admin
        .from("auto_clockout_audit")
        .delete()
        .in("worker_id", worker_ids);
      if (acaErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete auto_clockout_audit:", acaErr);
        return oops({ error: `Failed to delete auto clockout audit: ${acaErr.message}` });
      }
    }

    // 3. Get all manager IDs in this organization (for expense types)
    const { data: managers, error: managersErr } = await admin
      .from("managers")
      .select("id")
      .eq("organization_id", organization_id);

    if (managersErr) {
      console.error("[DELETE-ORGANIZATION] Failed to fetch managers:", managersErr);
      return oops({ error: "Failed to fetch managers" });
    }

    const manager_ids = (managers ?? []).map((m) => m.id);
    const manager_count = manager_ids.length;

    console.log(`[DELETE-ORGANIZATION] Found ${manager_count} managers`);

    // 4. Delete expense types (created by managers)
    if (manager_ids.length > 0) {
      const { error: etErr } = await admin
        .from("expense_types")
        .delete()
        .in("created_by", manager_ids);
      if (etErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete expense_types:", etErr);
        return oops({ error: `Failed to delete expense types: ${etErr.message}` });
      }
    }

    // 5. Delete workers
    const { error: wErr } = await admin
      .from("workers")
      .delete()
      .eq("organization_id", organization_id);
    if (wErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete workers:", wErr);
      return oops({ error: `Failed to delete workers: ${wErr.message}` });
    }

    // 6. Delete jobs
    const { error: jErr } = await admin
      .from("jobs")
      .delete()
      .eq("organization_id", organization_id);
    if (jErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete jobs:", jErr);
      return oops({ error: `Failed to delete jobs: ${jErr.message}` });
    }

    // 7. Delete managers
    const { error: mErr } = await admin
      .from("managers")
      .delete()
      .eq("organization_id", organization_id);
    if (mErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete managers:", mErr);
      return oops({ error: `Failed to delete managers: ${mErr.message}` });
    }

    // 8. Delete subscription usage
    const { error: suErr } = await admin
      .from("subscription_usage")
      .delete()
      .eq("organization_id", organization_id);
    if (suErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete subscription_usage:", suErr);
      return oops({ error: `Failed to delete subscription usage: ${suErr.message}` });
    }

    // 9. Delete super_admins for this org
    const { error: saErr } = await admin
      .from("super_admins")
      .delete()
      .eq("organization_id", organization_id);
    if (saErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete super_admins:", saErr);
      return oops({ error: `Failed to delete super admins: ${saErr.message}` });
    }

    // 10. Finally, delete the organization
    const { error: orgDelErr } = await admin
      .from("organizations")
      .delete()
      .eq("id", organization_id);

    if (orgDelErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete organization:", orgDelErr);
      return oops({ error: `Failed to delete organization: ${orgDelErr.message}` });
    }

    console.log(`[DELETE-ORGANIZATION] Successfully deleted organization: ${org.name}`);

    // Create audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      target_id: organization_id,
      action: "delete_organization",
      metadata: {
        organization_name: org.name,
        worker_count,
        manager_count,
      },
    });

    return json({
      success: true,
      details: {
        worker_count,
        manager_count,
      },
    });
  } catch (e: any) {
    console.error("[DELETE-ORGANIZATION] Unexpected error:", e);
    return oops({ error: e?.message ?? "Unexpected error occurred" });
  }
});
