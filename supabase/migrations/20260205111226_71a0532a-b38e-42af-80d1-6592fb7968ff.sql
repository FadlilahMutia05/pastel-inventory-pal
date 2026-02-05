-- Add theme color columns to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'pink',
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '339 82% 65%',
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '280 60% 97%';