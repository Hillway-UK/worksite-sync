import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-ORGANIZATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create client with user's token for authorization check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // Get requesting user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      logStep("Authentication failed", { error: userError });
      throw new Error('Unauthorized');
    }

    const { organizationId } = await req.json();
    logStep("Request data parsed", { organizationId, userEmail: user.email });

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Verify user is super admin of this organization
    const { data: superAdmin, error: adminError } = await supabaseClient
      .from('super_admins')
      .select('id, organization_id')
      .eq('email', user.email)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (adminError || !superAdmin) {
      logStep("Authorization failed", { error: adminError, superAdmin });
      throw new Error('Only super admins can delete their organization');
    }

    logStep("Authorization verified", { adminId: superAdmin.id });

    // Use service role for deletion operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all workers in the organization for cascading deletes
    const { data: workers, error: workersError } = await serviceClient
      .from('workers')
      .select('id')
      .eq('organization_id', organizationId);

    if (workersError) {
      logStep("Failed to fetch workers", { error: workersError });
      throw new Error(`Failed to fetch workers: ${workersError.message}`);
    }

    const workerIds = workers?.map(w => w.id) || [];
    logStep("Workers fetched", { count: workerIds.length });

    // Get all managers in the organization
    const { data: managers, error: managersError } = await serviceClient
      .from('managers')
      .select('id, email')
      .eq('organization_id', organizationId);

    if (managersError) {
      logStep("Failed to fetch managers", { error: managersError });
      throw new Error(`Failed to fetch managers: ${managersError.message}`);
    }

    const managerIds = managers?.map(m => m.id) || [];
    logStep("Managers fetched", { count: managerIds.length });

    // Delete in correct order to respect foreign keys
    const deletionSteps = [];

    // 1. Delete clock entries for workers
    if (workerIds.length > 0) {
      const { error: clockError } = await serviceClient
        .from('clock_entries')
        .delete()
        .in('worker_id', workerIds);
      
      if (clockError) {
        logStep("Failed to delete clock entries", { error: clockError });
        throw new Error(`Failed to delete clock entries: ${clockError.message}`);
      }
      deletionSteps.push('clock_entries');
      logStep("Clock entries deleted");
    }

    // 2. Delete time amendments
    if (workerIds.length > 0) {
      const { error: amendError } = await serviceClient
        .from('time_amendments')
        .delete()
        .in('worker_id', workerIds);
      
      if (amendError) {
        logStep("Failed to delete amendments", { error: amendError });
        throw new Error(`Failed to delete amendments: ${amendError.message}`);
      }
      deletionSteps.push('time_amendments');
      logStep("Amendments deleted");
    }

    // 3. Delete additional costs
    if (workerIds.length > 0) {
      const { error: costsError } = await serviceClient
        .from('additional_costs')
        .delete()
        .in('worker_id', workerIds);
      
      if (costsError) {
        logStep("Failed to delete additional costs", { error: costsError });
        throw new Error(`Failed to delete additional costs: ${costsError.message}`);
      }
      deletionSteps.push('additional_costs');
      logStep("Additional costs deleted");
    }

    // 4. Delete notifications
    if (workerIds.length > 0) {
      const { error: notifError } = await serviceClient
        .from('notifications')
        .delete()
        .in('worker_id', workerIds);
      
      if (notifError) {
        logStep("Failed to delete notifications", { error: notifError });
        throw new Error(`Failed to delete notifications: ${notifError.message}`);
      }
      deletionSteps.push('notifications');
      logStep("Notifications deleted");
    }

    // 5. Delete notification preferences
    if (workerIds.length > 0) {
      const { error: prefError } = await serviceClient
        .from('notification_preferences')
        .delete()
        .in('worker_id', workerIds);
      
      if (prefError) {
        logStep("Failed to delete notification preferences", { error: prefError });
        throw new Error(`Failed to delete notification preferences: ${prefError.message}`);
      }
      deletionSteps.push('notification_preferences');
      logStep("Notification preferences deleted");
    }

    // 6. Delete notification logs
    if (workerIds.length > 0) {
      const { error: logError } = await serviceClient
        .from('notification_log')
        .delete()
        .in('worker_id', workerIds);
      
      if (logError) {
        logStep("Failed to delete notification logs", { error: logError });
        throw new Error(`Failed to delete notification logs: ${logError.message}`);
      }
      deletionSteps.push('notification_log');
      logStep("Notification logs deleted");
    }

    // 7. Delete auto clockout counters
    if (workerIds.length > 0) {
      const { error: counterError } = await serviceClient
        .from('auto_clockout_counters')
        .delete()
        .in('worker_id', workerIds);
      
      if (counterError) {
        logStep("Failed to delete auto clockout counters", { error: counterError });
        throw new Error(`Failed to delete auto clockout counters: ${counterError.message}`);
      }
      deletionSteps.push('auto_clockout_counters');
      logStep("Auto clockout counters deleted");
    }

    // 8. Delete auto clockout audit
    if (workerIds.length > 0) {
      const { error: auditError } = await serviceClient
        .from('auto_clockout_audit')
        .delete()
        .in('worker_id', workerIds);
      
      if (auditError) {
        logStep("Failed to delete auto clockout audit", { error: auditError });
        throw new Error(`Failed to delete auto clockout audit: ${auditError.message}`);
      }
      deletionSteps.push('auto_clockout_audit');
      logStep("Auto clockout audit deleted");
    }

    // 9. Delete workers
    if (workerIds.length > 0) {
      const { error: workersDelError } = await serviceClient
        .from('workers')
        .delete()
        .eq('organization_id', organizationId);
      
      if (workersDelError) {
        logStep("Failed to delete workers", { error: workersDelError });
        throw new Error(`Failed to delete workers: ${workersDelError.message}`);
      }
      deletionSteps.push('workers');
      logStep("Workers deleted");
    }

    // 10. Delete jobs
    const { error: jobsError } = await serviceClient
      .from('jobs')
      .delete()
      .eq('organization_id', organizationId);
    
    if (jobsError) {
      logStep("Failed to delete jobs", { error: jobsError });
      throw new Error(`Failed to delete jobs: ${jobsError.message}`);
    }
    deletionSteps.push('jobs');
    logStep("Jobs deleted");

    // 11. Delete expense types (created by managers)
    if (managerIds.length > 0) {
      const { error: expenseError } = await serviceClient
        .from('expense_types')
        .delete()
        .in('created_by', managerIds);
      
      if (expenseError) {
        logStep("Failed to delete expense types", { error: expenseError });
        throw new Error(`Failed to delete expense types: ${expenseError.message}`);
      }
      deletionSteps.push('expense_types');
      logStep("Expense types deleted");
    }

    // 12. Delete managers
    const { error: managersDelError } = await serviceClient
      .from('managers')
      .delete()
      .eq('organization_id', organizationId);
    
    if (managersDelError) {
      logStep("Failed to delete managers", { error: managersDelError });
      throw new Error(`Failed to delete managers: ${managersDelError.message}`);
    }
    deletionSteps.push('managers');
    logStep("Managers deleted");

    // 13. Delete subscription usage
    const { error: subUsageError } = await serviceClient
      .from('subscription_usage')
      .delete()
      .eq('organization_id', organizationId);
    
    if (subUsageError) {
      logStep("Failed to delete subscription usage", { error: subUsageError });
      throw new Error(`Failed to delete subscription usage: ${subUsageError.message}`);
    }
    deletionSteps.push('subscription_usage');
    logStep("Subscription usage deleted");

    // 14. Delete super admins (except the one deleting)
    const { error: superAdminsError } = await serviceClient
      .from('super_admins')
      .delete()
      .eq('organization_id', organizationId);
    
    if (superAdminsError) {
      logStep("Failed to delete super admins", { error: superAdminsError });
      throw new Error(`Failed to delete super admins: ${superAdminsError.message}`);
    }
    deletionSteps.push('super_admins');
    logStep("Super admins deleted");

    // 15. Finally, delete the organization
    const { error: orgError } = await serviceClient
      .from('organizations')
      .delete()
      .eq('id', organizationId);
    
    if (orgError) {
      logStep("Failed to delete organization", { error: orgError });
      throw new Error(`Failed to delete organization: ${orgError.message}`);
    }
    deletionSteps.push('organizations');
    logStep("Organization deleted successfully");

    // Log audit trail
    try {
      await serviceClient
        .from('audit_logs')
        .insert({
          action: 'organization_deleted',
          actor_id: user.id,
          target_id: organizationId,
          metadata: {
            deleted_tables: deletionSteps,
            worker_count: workerIds.length,
            manager_count: managerIds.length
          }
        });
      logStep("Audit log created");
    } catch (auditErr) {
      // Non-critical, just log
      logStep("Failed to create audit log", { error: auditErr });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Organization and all related data deleted successfully",
      details: {
        deleted_tables: deletionSteps,
        worker_count: workerIds.length,
        manager_count: managerIds.length
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in delete-organization", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
