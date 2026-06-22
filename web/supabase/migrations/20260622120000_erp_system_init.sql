-- ==========================================
-- ERP System Initial Schema
-- ==========================================

-- 1. Categories
CREATE TABLE IF NOT EXISTS erp_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g. 'main', 'sub'
  parent_id UUID REFERENCES erp_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Items (Migrated from Pricing Naseem)
CREATE TABLE IF NOT EXISTS erp_items (
  item_code TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  proposed_name TEXT,
  approved_name TEXT,
  name_status TEXT DEFAULT 'لا يوجد',
  unit TEXT,
  main_category_id UUID REFERENCES erp_categories(id),
  sub_category_id UUID REFERENCES erp_categories(id),
  pricing_method TEXT DEFAULT 'تكلفة + هامش',
  cost_price_cents INTEGER,
  cost_source TEXT,
  supplier TEXT,
  cost_date TIMESTAMPTZ,
  profit_margin_percent REAL,
  suggested_selling_price_cents INTEGER,
  final_selling_price_cents INTEGER,
  pricing_status TEXT DEFAULT 'غير مسعّر',
  price_locked BOOLEAN DEFAULT false,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  door_pricing_enabled BOOLEAN DEFAULT false,
  door_unit_type TEXT,
  width REAL,
  height REAL,
  area REAL,
  price_per_m2_cents INTEGER,
  price_without_installation_cents INTEGER,
  installation_type TEXT,
  installation_fee_cents INTEGER,
  price_with_installation_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRM: Customers
CREATE TABLE IF NOT EXISTS erp_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  type TEXT DEFAULT 'retail', -- retail, wholesale, blacksmith
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CRM: Sales Orders / Quotes (NS-F-01)
CREATE TABLE IF NOT EXISTS erp_sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES erp_customers(id),
  status TEXT DEFAULT 'quote', -- quote, confirmed, in_production, delivered, cancelled
  total_amount_cents INTEGER DEFAULT 0,
  expected_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Blacksmith Special Orders (NS-F-16)
CREATE TABLE IF NOT EXISTS erp_blacksmith_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES erp_sales_orders(id),
  blacksmith_name TEXT NOT NULL,
  specifications TEXT,
  width REAL,
  height REAL,
  material_type TEXT,
  complexity_level TEXT DEFAULT 'normal',
  required_date DATE,
  status TEXT DEFAULT 'pending', -- pending, approved, in_production, ready, delivered
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Production Orders (NS-F-06)
CREATE TABLE IF NOT EXISTS erp_production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES erp_sales_orders(id),
  item_code TEXT REFERENCES erp_items(item_code),
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'planned', -- planned, in_progress, QA, finished
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CMMS: Machines & Maintenance
CREATE TABLE IF NOT EXISTS erp_machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  serial_number TEXT,
  purchase_date DATE,
  last_maintenance_date DATE,
  status TEXT DEFAULT 'operational', -- operational, under_maintenance, broken
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID REFERENCES erp_machines(id),
  type TEXT DEFAULT 'preventive', -- preventive, corrective
  description TEXT,
  cost_cents INTEGER,
  technician_name TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - to be configured later
ALTER TABLE erp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_blacksmith_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_maintenance_logs ENABLE ROW LEVEL SECURITY;
