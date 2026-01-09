import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      console.error('Missing Authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching jobs for user:', user.email)

    // Get manager's organization
    const { data: manager, error: managerError } = await supabaseClient
      .from('managers')
      .select('organization_id')
      .eq('email', user.email)
      .maybeSingle()

    if (managerError || !manager) {
      console.error('Manager lookup error:', managerError)
      return new Response(
        JSON.stringify({ error: 'Manager not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Manager organization_id:', manager.organization_id)

    // Fetch all jobs for the organization in ONE query
    const { data: jobs, error: jobsError } = await supabaseClient
      .from('jobs')
      .select(`
        id,
        code,
        name,
        address,
        address_line_1,
        address_line_2,
        city,
        county,
        postcode,
        latitude,
        longitude,
        geofence_radius,
        is_active,
        created_at,
        organization_id
      `)
      .eq('organization_id', manager.organization_id)
      .order('name')

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetched ${jobs?.length || 0} jobs`)

    // If no jobs, return empty result
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ jobs: [] }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get worker counts for all jobs in ONE aggregated query
    // Only count workers who are currently clocked in (clock_out is null)
    const jobIds = jobs.map(j => j.id)
    const { data: workerCounts, error: countsError } = await supabaseClient
      .from('clock_entries')
      .select('job_id')
      .is('clock_out', null)
      .in('job_id', jobIds)

    if (countsError) {
      console.error('Error fetching worker counts:', countsError)
      // Don't fail the entire request, just set counts to 0
    }

    console.log(`Fetched worker counts: ${workerCounts?.length || 0} active clock entries`)

    // Aggregate counts by job_id
    const countsByJob: Record<string, number> = {}
    if (workerCounts) {
      workerCounts.forEach(entry => {
        countsByJob[entry.job_id] = (countsByJob[entry.job_id] || 0) + 1
      })
    }

    // Combine jobs with their worker counts
    const jobsWithCounts = jobs.map(job => ({
      ...job,
      workers_on_site: countsByJob[job.id] || 0
    }))

    console.log('Successfully combined jobs with worker counts')

    return new Response(
      JSON.stringify({ jobs: jobsWithCounts }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in get-jobs-with-worker-counts:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
