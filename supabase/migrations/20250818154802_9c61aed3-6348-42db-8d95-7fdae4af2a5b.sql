-- Create expense_types table
CREATE TABLE public.expense_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

-- Enable Row Level Security
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;

-- Create policies for expense_types
CREATE POLICY "Managers can view all expense types" 
ON public.expense_types 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.managers 
  WHERE email = auth.email()
));

CREATE POLICY "Managers can create expense types" 
ON public.expense_types 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) AND 
  created_by IN (
    SELECT id FROM public.managers 
    WHERE email = auth.email()
  )
);

CREATE POLICY "Managers can update expense types" 
ON public.expense_types 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.managers 
  WHERE email = auth.email()
));

CREATE POLICY "Workers can view active expense types" 
ON public.expense_types 
FOR SELECT 
USING (
  is_active = true AND 
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE email = auth.email() AND is_active = true
  )
);

-- Add expense_type_id to additional_costs table
ALTER TABLE public.additional_costs 
ADD COLUMN expense_type_id UUID REFERENCES public.expense_types(id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_expense_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_expense_types_updated_at
BEFORE UPDATE ON public.expense_types
FOR EACH ROW
EXECUTE FUNCTION public.update_expense_types_updated_at();