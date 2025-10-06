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
      
      console.log('Google API response status:', googleResponse.status);
      
      if (googleResponse.ok) {
        const googleData = await googleResponse.json();
        console.log('Google API response:', { status: googleData.status, resultsCount: googleData.results?.length });
        
        if (googleData.status === 'OK' && googleData.results.length > 0) {
          const result = googleData.results[0];
          const location = result.geometry.location;
          
          console.log('✓ Google API success:', { lat: location.lat, lng: location.lng });
          
          const formattedPostcode = postcode || extractPostcodeFromGoogle(result.formatted_address);
          
          // Cache the result in local database for future lookups
          if (formattedPostcode && UK_POSTCODE_REGEX.test(formattedPostcode)) {
            try {
              await supabase.from('postcodes').upsert({
                postcode: formattedPostcode,
                latitude: location.lat.toString(),
                longitude: location.lng.toString(),
              }, { onConflict: 'postcode' });
              console.log('Cached postcode in local database');
            } catch (cacheError) {
              console.log('Failed to cache postcode (non-critical):', cacheError instanceof Error ? cacheError.message : 'Unknown error');
            }
          }
          
          return new Response(
            JSON.stringify({
              latitude: location.lat,
              longitude: location.lng,
              formatted_postcode: formattedPostcode,
              source: 'google'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        } else {
          console.log('Google API returned no results. Status:', googleData.status, 'Error:', googleData.error_message);
        }
      } else {
        console.log('Google API HTTP error:', googleResponse.status, googleResponse.statusText);
      }
    } catch (error) {
      console.log('✗ Google API failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;

    // Tier 2: Try local postcode database (UK postcodes only)
    if (postcode) {
      if (UK_POSTCODE_REGEX.test(postcode.trim())) {
        // Format postcode for database lookup
        const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
        const formattedPostcode = cleaned.length >= 5 
          ? `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
          : cleaned;

        try {
          console.log('Trying local postcode database for:', formattedPostcode);
          const { data: localResult, error: localError } = await supabase
            .from('postcodes')
            .select('latitude, longitude, postcode')
            .eq('postcode', formattedPostcode)
            .maybeSingle();

          if (localError) {
            console.log('✗ Local database error:', localError.message);
          } else if (localResult) {
            console.log('✓ Local database success:', localResult);
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
          } else {
            console.log('Local database: No match found for', formattedPostcode);
          }
        } catch (error) {
          console.log('✗ Local database exception:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    // Tier 3: Fall back to postcodes.io API (UK postcodes only)
    if (postcode) {
      if (!UK_POSTCODE_REGEX.test(postcode.trim())) {
        console.log('✗ Invalid postcode format:', postcode);
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

      console.log('Trying postcodes.io API as final fallback for:', formattedPostcode);
      const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`;
      
      try {
        const response = await fetch(url);
        console.log('Postcodes.io response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Postcodes.io response:', { status: data.status, hasResult: !!data.result });
          
          if (data.status === 200 && data.result) {
            console.log('✓ Postcodes.io success:', data.result);
            
            // Cache the successful result in local database
            try {
              await supabase.from('postcodes').upsert({
                postcode: data.result.postcode,
                latitude: data.result.latitude.toString(),
                longitude: data.result.longitude.toString(),
                town: data.result.admin_district,
                county: data.result.admin_county,
              }, { onConflict: 'postcode' });
              console.log('Cached postcode in local database');
            } catch (cacheError) {
              console.log('Failed to cache postcode (non-critical):', cacheError instanceof Error ? cacheError.message : 'Unknown error');
            }
            
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
          } else {
            console.log('✗ Postcodes.io: Invalid response structure or no result');
          }
        } else {
          console.log('✗ Postcodes.io HTTP error:', response.status, response.statusText);
          const errorText = await response.text();
          console.log('Postcodes.io error body:', errorText);
        }
      } catch (error) {
        console.log('✗ Postcodes.io exception:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // All geocoding methods failed
    console.log('✗ All geocoding methods exhausted');
    return new Response(
      JSON.stringify({ 
        error: `Unable to geocode "${postcode || fullAddress}". All geocoding services (Google, local database, postcodes.io) failed. Please manually set the location on the map by clicking.`,
        failedServices: ['google', 'local', 'postcodes.io']
      }),
      { 
        status: 503, 
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