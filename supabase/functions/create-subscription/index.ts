import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Use service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { plan } = await req.json();
    logStep("Request data parsed", { plan });

    // If it's a monthly subscription plan, create Stripe checkout session
    if (plan === 'monthly') {

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.name || user.email,
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

      // Create Stripe checkout session for monthly subscription
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: "Pioneer Auto Timesheets - Monthly Subscription",
                description: "Professional time tracking for construction teams"
              },
              unit_amount: 2650, // £26.50 base price in pence
              recurring: { interval: "month" }
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.headers.get("origin")}/organization?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/onboarding`,
        metadata: {
          user_id: user.id,
          plan: 'monthly'
        }
      });

      logStep("Created Stripe checkout session", { sessionId: session.id });

      return new Response(JSON.stringify({ 
        url: session.url,
        session_id: session.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get organization to update with Stripe customer ID (for non-subscription flows)
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id')
      .eq('id', user.user_metadata?.organization_id)
      .single();

    if (orgError) {
      logStep("Organization not found, looking up via super_admins");
      // Try to find via super_admins table
      const { data: admin, error: adminError } = await supabaseClient
        .from('super_admins')
        .select('organization_id')
        .eq('email', user.email)
        .single();

      if (adminError) throw new Error("No organization found for user");
      
      // Update organization with Stripe customer ID
      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({ 
          stripe_customer_id: customerId,
          subscription_status: 'inactive'
        })
        .eq('id', admin.organization_id);

      if (updateError) throw updateError;
      logStep("Updated organization with stripe customer ID", { orgId: admin.organization_id });
    } else {
      // Update organization with Stripe customer ID
      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({ 
          stripe_customer_id: customerId,
          subscription_status: 'inactive'
        })
        .eq('id', org.id);

      if (updateError) throw updateError;
      logStep("Updated organization with stripe customer ID", { orgId: org.id });
    }

    // Legacy response for non-subscription flows
    logStep("Customer setup complete");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Customer created successfully",
      customer_id: customerId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});