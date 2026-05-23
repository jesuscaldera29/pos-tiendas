-- ============================================
-- POS TIENDA DE ABARROTES - SUPABASE SCHEMA
-- ============================================

-- ============================================
-- LIMPIEZA DE ESQUEMA ANTERIOR (Evita errores)
-- ============================================
DROP TABLE IF EXISTS backups CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS cash_movements CASCADE;
DROP TABLE IF EXISTS cash_sessions CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS set_sale_number() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_business_id() CASCADE;
DROP FUNCTION IF EXISTS export_business_data(UUID) CASCADE;

-- 1. BUSINESSES TABLE
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_email TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  rfc TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'MXN',
  tax_rate DECIMAL(5,2) DEFAULT 16.00,
  tax_enabled BOOLEAN DEFAULT false,
  ticket_header TEXT DEFAULT '',
  ticket_footer TEXT DEFAULT 'Gracias por su compra',
  ticket_width INTEGER DEFAULT 80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES TABLE (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'cashier')),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  pin TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6C63FF',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  price_buy DECIMAL(10,2) DEFAULT 0,
  price_sell DECIMAL(10,2) NOT NULL,
  stock DECIMAL(10,3) DEFAULT 0,
  min_stock DECIMAL(10,3) DEFAULT 5,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT DEFAULT 'pieza',
  image_url TEXT,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CUSTOMERS
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 500,
  balance DECIMAL(10,2) DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SALES
CREATE TABLE sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  customer_id UUID REFERENCES customers(id),
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  cash_received DECIMAL(10,2),
  change_given DECIMAL(10,2),
  is_credit BOOLEAN DEFAULT false,
  session_id UUID,
  notes TEXT,
  sale_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SALE ITEMS
CREATE TABLE sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL
);

-- 8. CREDIT TRANSACTIONS
CREATE TABLE credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CASH SESSIONS
CREATE TABLE cash_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10,2),
  expected_amount DECIMAL(10,2),
  difference DECIMAL(10,2),
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  transfer_sales DECIMAL(10,2) DEFAULT 0,
  credit_sales DECIMAL(10,2) DEFAULT 0,
  payments_received DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  total_deposits DECIMAL(10,2) DEFAULT 0,
  total_withdrawals DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

-- 10. CASH MOVEMENTS
CREATE TABLE cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES cash_sessions(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES cash_sessions(id),
  category TEXT NOT NULL DEFAULT 'Otros',
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EXPENSE CATEGORIES
CREATE TABLE expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰'
);

-- 13. STOCK MOVEMENTS
CREATE TABLE stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'purchase', 'adjustment', 'return', 'waste')),
  quantity DECIMAL(10,3) NOT NULL,
  stock_before DECIMAL(10,3) NOT NULL,
  stock_after DECIMAL(10,3) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ACTIVITY LOG
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. BACKUPS METADATA
CREATE TABLE backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  tables_included TEXT[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_business ON sales(business_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_credit_trans_customer ON credit_transactions(customer_id);
CREATE INDEX idx_cash_sessions_business ON cash_sessions(business_id);
CREATE INDEX idx_expenses_business ON expenses(business_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_profiles_business ON profiles(business_id);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.email = 'jesuscaldera2000@gmail.com' THEN 'superadmin'
      ELSE 'admin'
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Auto-increment sale number per business
-- ============================================
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sale_number := COALESCE(
    (SELECT MAX(sale_number) FROM sales WHERE business_id = NEW.business_id), 0
  ) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_sale_insert
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION set_sale_number();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get user business_id
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- BUSINESSES policies
CREATE POLICY "Superadmin full access businesses" ON businesses
  FOR ALL USING (get_user_role() = 'superadmin');
CREATE POLICY "Users see own business" ON businesses
  FOR SELECT USING (id = get_user_business_id());

-- PROFILES policies
CREATE POLICY "Superadmin full access profiles" ON profiles
  FOR ALL USING (get_user_role() = 'superadmin');
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR business_id = get_user_business_id());
CREATE POLICY "Admin manage business profiles" ON profiles
  FOR ALL USING (get_user_role() = 'admin' AND business_id = get_user_business_id());

-- GENERIC business-scoped policies (for most tables)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['categories','products','customers','sales','credit_transactions','cash_sessions','expenses','expense_categories','stock_movements','activity_log','backups'])
  LOOP
    EXECUTE format('CREATE POLICY "superadmin_%s" ON %I FOR ALL USING (get_user_role() = ''superadmin'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "business_%s" ON %I FOR ALL USING (business_id = get_user_business_id())', tbl, tbl);
  END LOOP;
END $$;

-- SALE_ITEMS: access via sale
CREATE POLICY "superadmin_sale_items" ON sale_items FOR ALL USING (get_user_role() = 'superadmin');
CREATE POLICY "business_sale_items" ON sale_items
  FOR ALL USING (sale_id IN (SELECT id FROM sales WHERE business_id = get_user_business_id()));

-- CASH_MOVEMENTS: access via session
CREATE POLICY "superadmin_cash_movements" ON cash_movements FOR ALL USING (get_user_role() = 'superadmin');
CREATE POLICY "business_cash_movements" ON cash_movements
  FOR ALL USING (session_id IN (SELECT id FROM cash_sessions WHERE business_id = get_user_business_id()));

-- ============================================
-- FUNCTION: Full backup export
-- ============================================
CREATE OR REPLACE FUNCTION export_business_data(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'business', (SELECT row_to_json(b) FROM businesses b WHERE id = p_business_id),
    'categories', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM categories c WHERE business_id = p_business_id),
    'products', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM products p WHERE business_id = p_business_id),
    'customers', (SELECT COALESCE(jsonb_agg(row_to_json(cu)), '[]'::jsonb) FROM customers cu WHERE business_id = p_business_id),
    'sales', (SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) FROM sales s WHERE business_id = p_business_id),
    'sale_items', (SELECT COALESCE(jsonb_agg(row_to_json(si)), '[]'::jsonb) FROM sale_items si WHERE sale_id IN (SELECT id FROM sales WHERE business_id = p_business_id)),
    'credit_transactions', (SELECT COALESCE(jsonb_agg(row_to_json(ct)), '[]'::jsonb) FROM credit_transactions ct WHERE business_id = p_business_id),
    'expenses', (SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb) FROM expenses e WHERE business_id = p_business_id),
    'expense_categories', (SELECT COALESCE(jsonb_agg(row_to_json(ec)), '[]'::jsonb) FROM expense_categories ec WHERE business_id = p_business_id),
    'exported_at', NOW()
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
