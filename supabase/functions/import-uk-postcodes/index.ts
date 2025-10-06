import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface PostcodeRecord {
  postcode: string
  latitude: number
  longitude: number
  town?: string
  county?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { source = 'freemaptools', limit } = await req.json()
    
    console.log(`Starting UK postcode import from source: ${source}`)
    
    let importedCount = 0
    let errorCount = 0

    if (source === 'freemaptools') {
      // Download UK postcode data from FreeMapTools
      // This contains UK outward codes with lat/lng
      const response = await fetch('https://www.freemaptools.com/download/outcode-postcodes/postcode-outcodes.csv')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch postcode data: ${response.statusText}`)
      }

      const csvText = await response.text()
      const lines = csvText.split('\n')
      
      console.log(`Processing ${lines.length} postcode records...`)
      
      // Skip header row
      const dataLines = lines.slice(1).filter(line => line.trim())
      
      // Batch insert for better performance
      const batchSize = 500
      const maxRecords = limit || dataLines.length
      
      for (let i = 0; i < Math.min(dataLines.length, maxRecords); i += batchSize) {
        const batch = dataLines.slice(i, i + batchSize)
        const records: PostcodeRecord[] = []
        
        for (const line of batch) {
          try {
            const parts = line.split(',')
            if (parts.length >= 3) {
              const postcode = parts[0]?.trim().replace(/"/g, '')
              const latitude = parseFloat(parts[1]?.trim() || '0')
              const longitude = parseFloat(parts[2]?.trim() || '0')
              
              if (postcode && !isNaN(latitude) && !isNaN(longitude)) {
                records.push({
                  postcode: postcode,
                  latitude: latitude,
                  longitude: longitude,
                })
              }
            }
          } catch (error) {
            errorCount++
            console.error('Error parsing line:', line, error)
          }
        }
        
        if (records.length > 0) {
          const { error } = await supabase
            .from('postcodes')
            .upsert(
              records.map(r => ({
                postcode: r.postcode,
                latitude: r.latitude.toString(),
                longitude: r.longitude.toString(),
                town: r.town || null,
                county: r.county || null,
                country: 'United Kingdom',
              })),
              { onConflict: 'postcode' }
            )
          
          if (error) {
            console.error('Batch insert error:', error)
            errorCount += records.length
          } else {
            importedCount += records.length
            console.log(`Imported batch: ${importedCount} / ${Math.min(dataLines.length, maxRecords)}`)
          }
        }
      }
    } else if (source === 'postcodes.io-bulk') {
      // Alternative: Use postcodes.io bulk endpoint
      console.log('Fetching from postcodes.io bulk data...')
      
      // Download from postcodes.io (this is a large file ~120MB)
      const response = await fetch('https://api.postcodes.io/postcodes')
      
      if (!response.ok) {
        throw new Error('Failed to fetch from postcodes.io')
      }
      
      const data = await response.json()
      console.log('Processing postcodes.io data...')
      
      // Note: This would require handling large JSON response
      // For production, consider downloading the full dataset separately
    }

    console.log(`Import completed. Imported: ${importedCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        errors: errorCount,
        message: `Successfully imported ${importedCount} UK postcodes`,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during import',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
