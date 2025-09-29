import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { postcode } = await req.json()
    
    if (!postcode) {
      return new Response(
        JSON.stringify({ error: 'Postcode is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // UK postcode validation regex
    const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;
    
    if (!UK_POSTCODE_REGEX.test(postcode.trim())) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid postcode format: "${postcode}". Please use format like SW1A 1AA, M1 1AA, or B33 8TH` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Format postcode (uppercase, single space)
    const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
    const formattedPostcode = cleaned.length >= 5 
      ? `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
      : cleaned;

    console.log('Geocoding postcode:', formattedPostcode);

    // Call postcodes.io API
    const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: `Postcode "${formattedPostcode}" not found in database. Please check the postcode and try again.` 
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Too many requests. Please wait a moment and try again.' 
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.error(`API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `API error (${response.status}): ${response.statusText}` 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const data = await response.json();
    console.log('API Response:', data);

    if (data.status === 200 && data.result) {
      return new Response(
        JSON.stringify({
          latitude: data.result.latitude,
          longitude: data.result.longitude,
          formatted_postcode: data.result.postcode,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid response from postcode service' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in geocode-postcode function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})