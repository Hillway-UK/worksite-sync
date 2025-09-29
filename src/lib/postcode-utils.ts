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

// Geocode UK postcode using postcodes.io API
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
      throw new Error(error);
    }

    const formattedPostcode = formatPostcode(trimmedPostcode);
    console.log('Formatted postcode:', formattedPostcode);
    
    const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`;
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url);
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        const error = `Postcode "${formattedPostcode}" not found in database. Please check the postcode and try again.`;
        console.error(error);
        throw new Error(error);
      }
      if (response.status === 429) {
        const error = 'Too many requests. Please wait a moment and try again.';
        console.error(error);
        throw new Error(error);
      }
      const error = `API error (${response.status}): ${response.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const data: PostcodeApiResponse = await response.json();
    console.log('API Response data:', data);
    
    if (data.status === 200 && data.result) {
      const result = {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
        formatted_postcode: data.result.postcode,
      };
      console.log('Geocoding successful:', result);
      return result;
    }

    const error = 'Invalid response from postcode service';
    console.error(error, data);
    throw new Error(error);
  } catch (error) {
    console.error('Error geocoding postcode:', error);
    if (error instanceof Error) {
      return { latitude: 0, longitude: 0, formatted_postcode: trimmedPostcode, error: error.message };
    }
    return { latitude: 0, longitude: 0, formatted_postcode: trimmedPostcode, error: 'Unknown error occurred' };
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