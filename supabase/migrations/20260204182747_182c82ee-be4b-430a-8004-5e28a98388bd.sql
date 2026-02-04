-- Add shipping type and courier name columns to cargo_shipments
ALTER TABLE public.cargo_shipments 
ADD COLUMN shipping_type text NOT NULL DEFAULT 'cargo',
ADD COLUMN courier_name text NULL;

-- Add check constraint for valid shipping types
ALTER TABLE public.cargo_shipments
ADD CONSTRAINT cargo_shipments_shipping_type_check 
CHECK (shipping_type IN ('cargo', 'normal', 'sameday', 'instant'));