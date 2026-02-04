-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_transaction_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_code IS NULL OR NEW.transaction_code = '' THEN
    NEW.transaction_code := 'MAO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;