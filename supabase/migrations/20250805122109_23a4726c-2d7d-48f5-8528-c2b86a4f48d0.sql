-- Add missing fields to workers table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'address') THEN
        ALTER TABLE public.workers ADD COLUMN address text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'emergency_contact') THEN
        ALTER TABLE public.workers ADD COLUMN emergency_contact text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'emergency_phone') THEN
        ALTER TABLE public.workers ADD COLUMN emergency_phone text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'date_started') THEN
        ALTER TABLE public.workers ADD COLUMN date_started date DEFAULT CURRENT_DATE;
    END IF;
END $$;