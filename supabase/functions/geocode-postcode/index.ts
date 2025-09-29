import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
const googleApiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { postcode, fullAddress } = await req.json()
    
    if (!postcode && !fullAddress) {
      return new Response(
        JSON.stringify({ error: 'Postcode or full address is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Geocoding request:', { postcode, fullAddress });

    // Tier 1: Try Google Geocoding API first
    try {
      const addressToGeocode = fullAddress || postcode;
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressToGeocode)}&key=${googleApiKey}`;
      
      console.log('Trying Google Geocoding API...');
      const googleResponse = await fetch(googleUrl);
      
      if (googleResponse.ok) {
        const googleData = await googleResponse.json();
        
        if (googleData.status === 'OK' && googleData.results.length > 0) {
          const result = googleData.results[0];
          const location = result.geometry.location;
          
          console.log('Google API success:', { lat: location.lat, lng: location.lng });
          return new Response(
            JSON.stringify({
              latitude: location.lat,
              longitude: location.lng,
              formatted_postcode: postcode || extractPostcodeFromGoogle(result.formatted_address),
              source: 'google'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }
    } catch (error) {
      console.log('Google API failed, trying local database...', error instanceof Error ? error.message : 'Unknown error');
    }

    // Tier 2: Try local postcode database (UK postcodes only)
    if (postcode) {
      const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;
      
      if (UK_POSTCODE_REGEX.test(postcode.trim())) {
        // Format postcode for database lookup
        const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
        const formattedPostcode = cleaned.length >= 5 
          ? `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
          : cleaned;

        try {
          console.log('Trying local postcode database...');
          const { data: localResult, error: localError } = await supabase
            .from('postcodes')
            .select('latitude, longitude, postcode')
            .eq('postcode', formattedPostcode)
            .single();

          if (!localError && localResult) {
            console.log('Local database success:', localResult);
            return new Response(
              JSON.stringify({
                latitude: parseFloat(localResult.latitude),
                longitude: parseFloat(localResult.longitude),
                formatted_postcode: localResult.postcode,
                source: 'local'
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        } catch (error) {
          console.log('Local database failed, trying postcodes.io...', error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    // Tier 3: Fall back to postcodes.io API (UK postcodes only)
    if (postcode) {
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

      const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
      const formattedPostcode = cleaned.length >= 5 
        ? `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
        : cleaned;

      console.log('Trying postcodes.io API as final fallback...');
      const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 200 && data.result) {
          console.log('Postcodes.io success:', data.result);
          return new Response(
            JSON.stringify({
              latitude: data.result.latitude,
              longitude: data.result.longitude,
              formatted_postcode: data.result.postcode,
              source: 'postcodes.io'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }
    }

    // All geocoding methods failed
    return new Response(
      JSON.stringify({ 
        error: `Unable to geocode "${postcode || fullAddress}". Please check the address and try again.` 
      }),
      { 
        status: 404, 
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

// Helper function to extract postcode from Google's formatted address
function extractPostcodeFromGoogle(formattedAddress: string): string {
  const UK_POSTCODE_REGEX = /([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})/i;
  const match = formattedAddress.match(UK_POSTCODE_REGEX);
  return match ? `${match[1]} ${match[2]}`.toUpperCase() : '';
}