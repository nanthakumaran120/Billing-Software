-- Create Customers table
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  phone TEXT,
  stateCode TEXT DEFAULT '33',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hsn TEXT,
  rate DECIMAL(10,2),
  unit TEXT,
  tax DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Invoices table
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  customer_data JSONB, -- Stores a snapshot of customer info at time of billing
  items JSONB,
  invoice_details JSONB,
  total_amount DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Settings table
CREATE TABLE settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - For now, we'll keep it simple, but in production, you'd restrict this
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all access (since we are using the service role or anon key for simplicity)
CREATE POLICY "Allow all" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true);
