// UK postcode validation and geocoding utilities

// UK postcode regex pattern - supports all valid UK postcode formats
export const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;

// Validate UK postcode format
export function validatePostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test(postcode.trim());
}

// Format postcode to standard format (uppercase, single space)
export function formatPostcode(postcode: string): string {
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
}

// Interface for postcodes.io API response
interface PostcodeResult {
  postcode: string;
  quality: number;
  eastings: number;
  northings: number;
  country: string;
  nhs_ha: string;
  longitude: number;
  latitude: number;
  european_electoral_region: string;
  primary_care_trust: string;
  region: string;
  lsoa: string;
  msoa: string;
  incode: string;
  outcode: string;
  parliamentary_constituency: string;
  admin_district: string;
  parish: string;
  admin_county: string;
  admin_ward: string;
  ced: string;
  ccg: string;
  nuts: string;
  codes: {
    admin_district: string;
    admin_county: string;
    admin_ward: string;
    parish: string;
    parliamentary_constituency: string;
    ccg: string;
    ccg_id: string;
    ced: string;
    nuts: string;
    lsoa: string;
    msoa: string;
    lau2: string;
  };
}

interface PostcodeApiResponse {
  status: number;
  result: PostcodeResult;
}

// Geocode UK postcode using Supabase Edge Function
export async function geocodePostcode(postcode: string): Promise<{
  latitude: number;
  longitude: number;
  formatted_postcode: string;
  error?: string;
} | null> {
  const trimmedPostcode = postcode.trim();
  console.log('Geocoding postcode:', trimmedPostcode);
  
  try {
    if (!validatePostcode(trimmedPostcode)) {
      const error = `Invalid postcode format: "${trimmedPostcode}". Please use format like SW1A 1AA, M1 1AA, or B33 8TH`;
      console.error(error);
      return { latitude: 0, longitude: 0, formatted_postcode: trimmedPostcode, error };
    }

    // Import Supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');

    // Call our Supabase Edge Function using the client's invoke method
    const { data, error } = await supabase.functions.invoke('geocode-postcode', {
      body: { postcode: trimmedPostcode }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { 
        latitude: 0, 
        longitude: 0, 
        formatted_postcode: trimmedPostcode, 
        error: `Geocoding service error: ${error.message}. You can still manually set the location on the map.`
      };
    }

    if (!data || data.latitude === undefined || data.longitude === undefined) {
      return { 
        latitude: 0, 
        longitude: 0, 
        formatted_postcode: trimmedPostcode, 
        error: 'No location data returned. You can manually set the location on the map.'
      };
    }

    console.log('Geocoding successful:', data);
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      formatted_postcode: data.formatted_postcode || trimmedPostcode,
    };

  } catch (error) {
    console.error('Error geocoding postcode:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { 
      latitude: 0, 
      longitude: 0, 
      formatted_postcode: trimmedPostcode, 
      error: `${errorMessage}. You can manually set the location on the map by clicking.`
    };
  }
}

// Format structured address into a single string for legacy field
export function formatLegacyAddress(
  addressLine1: string,
  addressLine2?: string,
  city?: string,
  county?: string,
  postcode?: string
): string {
  const parts = [
    addressLine1,
    addressLine2,
    city,
    county,
    postcode
  ].filter(Boolean);
  
  return parts.join(', ');
}

// Parse legacy address into structured components (best effort)
export function parseLegacyAddress(address: string): {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  county?: string;
  postcode?: string;
} {
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  
  if (parts.length === 0) return {};
  
  // Try to identify postcode (last part that matches UK postcode format)
  let postcode: string | undefined;
  let remainingParts = [...parts];
  
  for (let i = parts.length - 1; i >= 0; i--) {
    if (validatePostcode(parts[i])) {
      postcode = formatPostcode(parts[i]);
      remainingParts = parts.slice(0, i);
      break;
    }
  }
  
  const result: ReturnType<typeof parseLegacyAddress> = {};
  
  if (postcode) result.postcode = postcode;
  
  // Assign remaining parts
  if (remainingParts.length >= 1) result.address_line_1 = remainingParts[0];
  if (remainingParts.length >= 2) result.address_line_2 = remainingParts[1];
  if (remainingParts.length >= 3) result.city = remainingParts[2];
  if (remainingParts.length >= 4) result.county = remainingParts[3];
  
  // If we have more than 4 parts, merge extras into city
  if (remainingParts.length > 4) {
    result.city = remainingParts.slice(2).join(', ');
  }
  
  return result;
}