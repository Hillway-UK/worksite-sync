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

    // --- AUTH / ROLE CHECK ---

    // Verify JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[DELETE-ORGANIZATION] Missing or invalid Authorization header");
      return forbid({ error: "Missing or invalid authorization token" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: verifyError } = await admin.auth.getUser(token);

    if (verifyError || !userData?.user) {
      console.error("[DELETE-ORGANIZATION] Auth verification failed:", verifyError);
      return forbid({ error: "Invalid or expired token" });
    }

    const user = userData.user;
    console.log(`[DELETE-ORGANIZATION] User authenticated: ${user.email}`);

    // 1) Check app_metadata / user_metadata
    const am: any = user.app_metadata ?? {};
    const um: any = user.user_metadata ?? {};

    const metaRoles: string[] = Array.isArray(am.roles)
      ? am.roles
      : typeof am.roles === "string"
      ? [am.roles]
      : [];

    const singleMetaRole = am.role || um.role; // may be a string

    const isSuperFromMeta =
      (singleMetaRole === "superadmin") ||
      (singleMetaRole === "super_admin") ||
      metaRoles.includes("superadmin") ||
      metaRoles.includes("super_admin") ||
      am.is_superadmin === true ||
      um.is_superadmin === true;

    // 2) Fallback: check super_admins table (uses email)
    let isSuperFromSuperAdminsTable = false;
    {
      const { data: saRow, error: saErr } = await admin
        .from("super_admins")
        .select("id, email, is_owner")
        .eq("email", user.email)
        .maybeSingle();

      if (saErr) {
        console.error("[DELETE-ORGANIZATION] super_admins table check error:", saErr);
      } else {
        isSuperFromSuperAdminsTable = Boolean(saRow?.id); // exists in super_admins
      }
    }

    // 3) Additional fallback: check managers table for is_super flag
    let isSuperFromManagersTable = false;
    {
      const { data: mgrRow, error: mgrErr } = await admin
        .from("managers")
        .select("id, email, is_super")
        .eq("email", user.email)
        .maybeSingle();

      if (mgrErr) {
        console.error("[DELETE-ORGANIZATION] managers table check error:", mgrErr);
      } else {
        isSuperFromManagersTable = Boolean(mgrRow?.is_super);
      }
    }

    const isSuperadmin = isSuperFromMeta || isSuperFromSuperAdminsTable || isSuperFromManagersTable;

    // Comprehensive debug logging
    console.log("[DELETE-ORGANIZATION] auth debug", {
      uid: user.id,
      email: user.email,
      am_role: am.role,
      am_roles: am.roles,
      am_is_superadmin: am.is_superadmin,
      um_role: um.role,
      um_is_superadmin: um.is_superadmin,
      isSuperFromMeta,
      isSuperFromSuperAdminsTable,
      isSuperFromManagersTable,
      final_isSuperadmin: isSuperadmin,
    });

    if (!isSuperadmin) {
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
      // Fetch related clock entry IDs (needed for dependent table cleanup)
      const { data: ceRows, error: ceIdsErr } = await admin
        .from("clock_entries")
        .select("id")
        .in("worker_id", worker_ids);
      if (ceIdsErr) {
        console.error("[DELETE-ORGANIZATION] Failed to fetch clock_entry ids:", ceIdsErr);
        return oops({ error: `Failed to fetch clock entry ids: ${ceIdsErr.message}` });
      }
      const clock_entry_ids = (ceRows ?? []).map((r: { id: string }) => r.id);
      console.log(`[DELETE-ORGANIZATION] Found ${clock_entry_ids.length} clock entries`);

      // Fetch time amendment IDs (needed for clock_entry_history cleanup)
      const { data: amendRows, error: amendIdsErr } = await admin
        .from("time_amendments")
        .select("id")
        .in("worker_id", worker_ids);
      if (amendIdsErr) {
        console.error("[DELETE-ORGANIZATION] Failed to fetch amendment ids:", amendIdsErr);
        return oops({ error: `Failed to fetch amendment ids: ${amendIdsErr.message}` });
      }
      const amendment_ids = (amendRows ?? []).map((r: { id: string }) => r.id);
      console.log(`[DELETE-ORGANIZATION] Found ${amendment_ids.length} time amendments`);

      // STEP 1: Delete clock_entry_history FIRST (deepest dependency - references both clock_entries AND time_amendments)
      if (clock_entry_ids.length > 0 || amendment_ids.length > 0) {
        const conditions = [];
        if (clock_entry_ids.length > 0) {
          conditions.push(`clock_entry_id.in.(${clock_entry_ids.join(",")})`);
        }
        if (amendment_ids.length > 0) {
          conditions.push(`amendment_id.in.(${amendment_ids.join(",")})`);
        }
        
        const { error: cehErr } = await admin
          .from("clock_entry_history")
          .delete()
          .or(conditions.join(","));
        if (cehErr) {
          console.error("[DELETE-ORGANIZATION] Failed to delete clock_entry_history:", cehErr);
          return oops({ error: `Failed to delete clock entry history: ${cehErr.message}` });
        }
      }

      // STEP 2: Delete geofence_events (references clock_entries and workers)
      if (clock_entry_ids.length > 0) {
        const { error: gfErr } = await admin
          .from("geofence_events")
          .delete()
          .in("clock_entry_id", clock_entry_ids);
        if (gfErr) {
          console.error("[DELETE-ORGANIZATION] Failed to delete geofence_events:", gfErr);
          return oops({ error: `Failed to delete geofence events: ${gfErr.message}` });
        }
      }

      // STEP 3: Delete additional_costs (references clock_entries and workers)
      if (clock_entry_ids.length > 0) {
        const { error: acByCeErr } = await admin
          .from("additional_costs")
          .delete()
          .in("clock_entry_id", clock_entry_ids);
        if (acByCeErr) {
          console.error("[DELETE-ORGANIZATION] Failed to delete additional_costs by clock_entry_id:", acByCeErr);
          return oops({ error: `Failed to delete additional costs (by clock entry): ${acByCeErr.message}` });
        }
      }

      // Additional costs by worker (catch costs not linked to a clock entry)
      const { error: acByWorkerErr } = await admin
        .from("additional_costs")
        .delete()
        .in("worker_id", worker_ids);
      if (acByWorkerErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete additional_costs by worker_id:", acByWorkerErr);
        return oops({ error: `Failed to delete additional costs (by worker): ${acByWorkerErr.message}` });
      }

      // STEP 4: Delete time_amendments (now safe after clock_entry_history is gone)
      const { error: taErr } = await admin
        .from("time_amendments")
        .delete()
        .in("worker_id", worker_ids);
      if (taErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete time_amendments:", taErr);
        return oops({ error: `Failed to delete time amendments: ${taErr.message}` });
      }

      // STEP 5: Delete clock_entries (now safe after all dependencies are gone)
      const { error: ceErr } = await admin
        .from("clock_entries")
        .delete()
        .in("worker_id", worker_ids);
      if (ceErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete clock_entries:", ceErr);
        return oops({ error: `Failed to delete clock entries: ${ceErr.message}` });
      }

      // STEP 6: Delete worker-related notification and tracking data
      const { error: notifErr } = await admin
        .from("notifications")
        .delete()
        .in("worker_id", worker_ids);
      if (notifErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notifications:", notifErr);
        return oops({ error: `Failed to delete notifications: ${notifErr.message}` });
      }

      const { error: npErr } = await admin
        .from("notification_preferences")
        .delete()
        .in("worker_id", worker_ids);
      if (npErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notification_preferences:", npErr);
        return oops({ error: `Failed to delete notification preferences: ${npErr.message}` });
      }

      const { error: nlErr } = await admin
        .from("notification_log")
        .delete()
        .in("worker_id", worker_ids);
      if (nlErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete notification_log:", nlErr);
        return oops({ error: `Failed to delete notification log: ${nlErr.message}` });
      }

      const { error: accErr } = await admin
        .from("auto_clockout_counters")
        .delete()
        .in("worker_id", worker_ids);
      if (accErr) {
        console.error("[DELETE-ORGANIZATION] Failed to delete auto_clockout_counters:", accErr);
        return oops({ error: `Failed to delete auto clockout counters: ${accErr.message}` });
      }

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

    // 10. Delete subscription_audit_log for this org
    const { error: salErr } = await admin
      .from("subscription_audit_log")
      .delete()
      .eq("organization_id", organization_id);
    if (salErr) {
      console.error("[DELETE-ORGANIZATION] Failed to delete subscription_audit_log:", salErr);
      return oops({ error: `Failed to delete subscription audit log: ${salErr.message}` });
    }

    // 11. Finally, delete the organization
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
