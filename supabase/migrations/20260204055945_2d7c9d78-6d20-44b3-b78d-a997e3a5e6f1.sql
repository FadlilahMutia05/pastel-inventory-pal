-- =============================================
-- Mao~Mao Store Database Schema
-- =============================================

-- 1. Suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  country TEXT DEFAULT 'China',
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Products table (master produk)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Blindbox',
  description TEXT,
  photo_url TEXT,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  pcs_per_set INTEGER NOT NULL DEFAULT 1,
  sets_per_karton INTEGER NOT NULL DEFAULT 1,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Product batches table (untuk FIFO - stok per batch dengan harga modal)
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cargo_shipment_id UUID, -- Will add FK after cargo_shipments created
  batch_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Cargo shipments table (kargo masuk)
CREATE TABLE public.cargo_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'shipped', 'customs', 'arrived', 'received')),
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_date TIMESTAMP WITH TIME ZONE,
  customs_date TIMESTAMP WITH TIME ZONE,
  arrived_date TIMESTAMP WITH TIME ZONE,
  received_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add FK to product_batches for cargo_shipment_id
ALTER TABLE public.product_batches 
ADD CONSTRAINT fk_product_batches_cargo 
FOREIGN KEY (cargo_shipment_id) REFERENCES public.cargo_shipments(id) ON DELETE SET NULL;

-- 5. Cargo shipment items (detail item per kargo)
CREATE TABLE public.cargo_shipment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo_shipment_id UUID NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Sales transactions table
CREATE TABLE public.sales_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_city TEXT,
  customer_address TEXT,
  courier TEXT NOT NULL DEFAULT 'JNE',
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'packing', 'shipped', 'completed', 'cancelled')),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Transaction items table (detail item per transaksi)
CREATE TABLE public.transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- Create update_updated_at function
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Create triggers for updated_at
-- =============================================
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cargo_shipments_updated_at
  BEFORE UPDATE ON public.cargo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_transactions_updated_at
  BEFORE UPDATE ON public.sales_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Generate transaction code function
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_transaction_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_code IS NULL OR NEW.transaction_code = '' THEN
    NEW.transaction_code := 'MAO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_transaction_code_trigger
  BEFORE INSERT ON public.sales_transactions
  FOR EACH ROW EXECUTE FUNCTION public.generate_transaction_code();

-- =============================================
-- Storage bucket for product photos
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true);

-- Storage policies for product photos
CREATE POLICY "Product photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

CREATE POLICY "Anyone can upload product photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "Anyone can update product photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-photos');

CREATE POLICY "Anyone can delete product photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos');

-- =============================================
-- RLS Policies (public access since no auth)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Public access policies (single user, no auth required)
CREATE POLICY "Public access for suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for product_batches" ON public.product_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cargo_shipments" ON public.cargo_shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cargo_shipment_items" ON public.cargo_shipment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for sales_transactions" ON public.sales_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for transaction_items" ON public.transaction_items FOR ALL USING (true) WITH CHECK (true);