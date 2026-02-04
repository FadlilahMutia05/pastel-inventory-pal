-- Add shipping_type column to sales_transactions
ALTER TABLE public.sales_transactions
ADD COLUMN shipping_type text NOT NULL DEFAULT 'normal'
CHECK (shipping_type IN ('cargo', 'normal', 'sameday', 'instant'));