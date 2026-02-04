-- Create store_settings table for branding and profile
CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name text NOT NULL DEFAULT 'Mao~Mao Store',
  tagline text DEFAULT 'Blindbox Manager',
  logo_url text DEFAULT NULL,
  logo_emoji text DEFAULT '🎁',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (single-user app)
CREATE POLICY "Public access for store_settings" 
ON public.store_settings 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert default settings
INSERT INTO public.store_settings (store_name, tagline, logo_emoji) 
VALUES ('Mao~Mao Store', 'Blindbox Manager', '🎁');

-- Add trigger for updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();