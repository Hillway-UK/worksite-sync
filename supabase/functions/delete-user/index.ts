import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email, table } = await req.json();

    if (!email || !table) {
      return new Response(
        JSON.stringify({ error: 'Email and table are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (table !== 'workers' && table !== 'managers') {
      return new Response(
        JSON.stringify({ error: 'Invalid table specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Attempting to delete user with email: ${email} from table: ${table}`);

    // First, get the auth user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const authUser = users.find(u => u.email === email);
    
    // Delete from the appropriate table
    const { error: tableError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('email', email);
    
    if (tableError) {
      console.error(`Error deleting from ${table}:`, tableError);
      throw tableError;
    }

    // Delete from auth.users if found
    if (authUser) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // Return partial success
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'User deleted from database but auth deletion failed',
            authError: authDeleteError.message 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Successfully deleted auth user: ${authUser.id}`);
    } else {
      console.log('No auth user found with that email');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in delete-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
