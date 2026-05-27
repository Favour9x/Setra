-- Add missing columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS sender_address text;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
