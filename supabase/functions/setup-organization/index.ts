import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SETUP-ORGANIZATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Use service role key to bypass RLS for organization creation
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { orgData, userId } = await req.json();
    logStep("Request data parsed", { orgData: { name: orgData.name, email: orgData.admin_email }, userId });

    // Create organization
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .insert({
        name: orgData.name,
        company_number: orgData.company_number || null,
        vat_number: orgData.vat_number || null,
        address: orgData.address || null,
        phone: orgData.phone || null,
        email: orgData.email || orgData.admin_email,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 14 days from now
      })
      .select()
      .single();

    if (orgError) {
      logStep("Organization creation failed", { error: orgError });
      throw orgError;
    }

    logStep("Organization created", { orgId: org.id });

    // Create super admin
    const { error: adminError } = await supabaseClient
      .from('super_admins')
      .insert({
        email: orgData.admin_email,
        name: orgData.admin_name,
        organization_id: org.id,
        is_owner: true
      });

    if (adminError) {
      logStep("Super admin creation failed", { error: adminError });
      throw adminError;
    }

    logStep("Super admin created successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      organization_id: org.id,
      message: "Organization and admin created successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in setup-organization", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});