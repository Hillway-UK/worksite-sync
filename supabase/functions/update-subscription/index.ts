import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { organizationId, managerCount, workerCount } = await req.json();
    logStep("Request data parsed", { organizationId, managerCount, workerCount });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Use service role for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get organization data
    const { data: org, error: orgError } = await supabaseService
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");
    if (!org.stripe_customer_id) throw new Error("No Stripe customer found for organization");

    logStep("Organization data retrieved", { customerId: org.stripe_customer_id });

    // Calculate new amount
    const newAmount = (managerCount * 25) + (workerCount * 1.5);

    // If there's an existing subscription, update it
    if (org.stripe_subscription_id) {
      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const subscriptionItem = subscription.items.data[0];

      // Update the subscription item with new pricing
      await stripe.subscriptionItems.update(subscriptionItem.id, {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Pioneer Time Tracking - Monthly Subscription',
            description: `${managerCount} Manager(s) + ${workerCount} Worker(s)`,
          },
          unit_amount: Math.round(newAmount * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      });

      logStep("Updated existing subscription", { subscriptionId: org.stripe_subscription_id });
    } else {
      // Create new subscription
      const subscription = await stripe.subscriptions.create({
        customer: org.stripe_customer_id,
        items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Pioneer Time Tracking - Monthly Subscription',
              description: `${managerCount} Manager(s) + ${workerCount} Worker(s)`,
            },
            unit_amount: Math.round(newAmount * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        metadata: {
          organizationId: organizationId,
          managerCount: managerCount.toString(),
          workerCount: workerCount.toString(),
        },
      });

      // Update organization with subscription ID
      await supabaseService
        .from('organizations')
        .update({ stripe_subscription_id: subscription.id })
        .eq('id', organizationId);

      logStep("Created new subscription", { subscriptionId: subscription.id });
    }

    // Update organization limits
    await supabaseService
      .from('organizations')
      .update({ 
        max_managers: managerCount,
        max_workers: workerCount
      })
      .eq('id', organizationId);

    logStep("Updated organization limits");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in update-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});