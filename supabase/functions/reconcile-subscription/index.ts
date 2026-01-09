import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconcileRequest {
  organization_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get request body
    const { organization_id, reason = 'manual_reconciliation' }: ReconcileRequest = await req.json();

    console.log('Reconciliation requested', { organization_id, reason });

    // Verify caller is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabaseClient
      .from('super_admins')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run reconciliation function
    const { data: reconcileResults, error: reconcileError } = await supabaseClient
      .rpc('reconcile_subscription_usage');

    if (reconcileError) {
      console.error('Reconciliation failed:', reconcileError);
      return new Response(
        JSON.stringify({ error: 'Reconciliation failed', details: reconcileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the reconciliation action
    if (reconcileResults && reconcileResults.length > 0) {
      for (const result of reconcileResults) {
        await supabaseClient
          .from('subscription_audit_log')
          .insert({
            organization_id: result.org_id,
            action: 'manual_reconciliation',
            before_count: result.old_workers,
            after_count: result.new_workers,
            trigger_source: 'manual_api',
            metadata: {
              org_name: result.org_name,
              old_managers: result.old_managers,
              new_managers: result.new_managers,
              reason,
              triggered_by: user.email
            }
          });
      }
    }

    // Get validation results to show any remaining discrepancies
    const { data: validationResults } = await supabaseClient
      .rpc('validate_subscription_counts');

    const response = {
      success: true,
      reconciled: reconcileResults || [],
      remaining_discrepancies: validationResults || [],
      message: reconcileResults?.length > 0 
        ? `Reconciled ${reconcileResults.length} organization(s)` 
        : 'No discrepancies found'
    };

    console.log('Reconciliation complete:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});