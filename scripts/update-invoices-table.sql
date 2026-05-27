-- Alter public.invoices table to support delivery features and confirmation states
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add recipient_email column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Add email_status column to track Resend/Nodemailer operations
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending';

-- Add payer_address column to record the sender's wallet address
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payer_address TEXT;

-- Add updated check constraint to allow awaiting_confirmation state
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid', 'expired', 'awaiting_confirmation'));
