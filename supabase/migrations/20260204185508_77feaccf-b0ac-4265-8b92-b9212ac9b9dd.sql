-- Add brand and series columns to products table
ALTER TABLE public.products
ADD COLUMN brand text DEFAULT NULL,
ADD COLUMN series text DEFAULT NULL;