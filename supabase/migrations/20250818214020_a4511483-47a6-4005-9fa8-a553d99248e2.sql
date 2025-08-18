-- Add photo_url column to workers table
ALTER TABLE public.workers 
ADD COLUMN photo_url TEXT;

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-photos', 'worker-photos', true);

-- Create RLS policies for worker-photos bucket
CREATE POLICY "Workers can view their own photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'worker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can upload their own photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'worker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can update their own photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'worker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can delete their own photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'worker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);