import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpgradeRequest {
  organizationId: string;
  newMaxManagers: number;
  newMaxWorkers: number;
  planType: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { organizationId, newMaxManagers, newMaxWorkers, planType } = await req.json() as UpgradeRequest;

    console.log(`Upgrading subscription for organization ${organizationId} to ${planType} plan`);

    // Verify user is super admin of the organization
    const { data: isSuperAdmin, error: permError } = await supabase
      .rpc('is_super_admin_of_org', { org_id: organizationId });

    if (permError || !isSuperAdmin) {
      throw new Error('Only super admins can upgrade subscription plans');
    }

    // Call the upgrade_subscription_plan function
    const { data: newSubscriptionId, error: upgradeError } = await supabase
      .rpc('upgrade_subscription_plan', {
        p_org_id: organizationId,
        p_new_max_managers: newMaxManagers,
        p_new_max_workers: newMaxWorkers,
        p_plan_type: planType
      });

    if (upgradeError) {
      console.error('Upgrade error:', upgradeError);
      throw new Error(`Failed to upgrade subscription: ${upgradeError.message}`);
    }

    console.log(`Successfully upgraded subscription. New subscription ID: ${newSubscriptionId}`);

    // Fetch the new subscription details
    const { data: newSubscription, error: fetchError } = await supabase
      .from('subscription_usage')
      .select('*')
      .eq('id', newSubscriptionId)
      .single();

    if (fetchError) {
      console.error('Error fetching new subscription:', fetchError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: newSubscriptionId,
        subscription: newSubscription,
        message: `Successfully upgraded to ${planType} plan`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in upgrade-subscription-plan function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
