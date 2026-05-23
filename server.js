import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Prevent caching for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/customers' || req.path === '/products' || req.path === '/invoices' || req.path === '/settings') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Initialize Supabase if credentials are provided in env variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Using Supabase cloud database for storage!");
} else {
  console.log("Using local JSON file database for storage.");
}

// Helper to read/write JSON files (fallback for offline mode)
const DB_PATH = path.join(__dirname, 'data');
const readJSON = (file) => JSON.parse(fs.readFileSync(path.join(DB_PATH, file), 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(path.join(DB_PATH, file), JSON.stringify(data, null, 2), 'utf8');

const getFinancialYear = (dateStr) => {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) {
    return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }
};

const getMonthFolderName = (dateStr) => {
  const d = new Date(dateStr);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[d.getMonth()];
  const month = d.getMonth() + 1;
  const year2 = d.getFullYear().toString().slice(-2);
  return `${month}-${monthName}-${year2}`;
};

// --- CUSTOMERS API ---
app.get('/customers', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } else {
      const db = readJSON('customerdb.json');
      res.json(db.customers || []);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/customers', async (req, res) => {
  try {
    const customer = req.body;
    if (supabase) {
      const { error } = await supabase.from('customers').upsert({
        id: customer.id,
        name: customer.name,
        gstin: customer.gstin,
        address: customer.address,
        phone: customer.phone,
        stateCode: customer.stateCode
      });
      if (error) throw error;
      res.status(201).json(customer);
    } else {
      const db = readJSON('customerdb.json');
      const index = db.customers.findIndex(c => c.id === customer.id);
      if (index > -1) {
        db.customers[index] = customer;
      } else {
        db.customers.push(customer);
      }
      writeJSON('customerdb.json', db);
      res.status(201).json(customer);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PRODUCTS API ---
app.get('/products', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const formatted = data.map(p => ({
        id: p.id,
        description: p.name,
        hsn: p.hsn,
        rate: p.rate !== null ? p.rate.toString() : "",
        per: p.unit
      }));
      res.json(formatted || []);
    } else {
      const db = readJSON('productdb.json');
      res.json(db.products || []);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const product = req.body;
    if (supabase) {
      const { error } = await supabase.from('products').upsert({
        id: product.id,
        name: product.description,
        hsn: product.hsn,
        rate: product.rate !== "" ? parseFloat(product.rate) : null,
        unit: product.per
      });
      if (error) throw error;
      res.status(201).json(product);
    } else {
      const db = readJSON('productdb.json');
      const index = db.products.findIndex(p => p.id === product.id);
      if (index > -1) {
        db.products[index] = product;
      } else {
        db.products.push(product);
      }
      writeJSON('productdb.json', db);
      res.status(201).json(product);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- INVOICES API ---
app.get('/invoices', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const formatted = data.map(inv => ({
        id: inv.id,
        customer: inv.customer_data,
        items: inv.items,
        invoiceDetails: inv.invoice_details,
        totalAmount: inv.total_amount,
        createdAt: inv.created_at
      }));
      res.json(formatted || []);
    } else {
      const db = readJSON('invoicedb.json');
      res.json(db.invoices || []);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/invoices', async (req, res) => {
  try {
    const invoice = req.body;
    if (supabase) {
      const customerId = invoice.customer?.id || null;
      const { error } = await supabase.from('invoices').insert({
        id: invoice.id,
        customer_id: customerId,
        customer_data: invoice.customer,
        items: invoice.items,
        invoice_details: invoice.invoiceDetails,
        total_amount: parseFloat(invoice.totalAmount) || 0
      });
      if (error) throw error;

      // Update next invoice number
      const nextNo = (parseInt(invoice.invoiceDetails?.invoiceNo) || 0) + 1;
      const { data: existingSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'invoice_settings')
        .maybeSingle();
      
      const settingsVal = existingSettings?.value || {};
      settingsVal.nextInvoiceNo = nextNo;

      await supabase.from('settings').upsert({
        key: 'invoice_settings',
        value: settingsVal
      });

      res.status(201).json(invoice);
    } else {
      const db = readJSON('invoicedb.json');
      db.invoices.push(invoice);
      
      // Update next invoice number
      if (db.settings) {
        db.settings.nextInvoiceNo = (parseInt(invoice.invoiceDetails?.invoiceNo) || 0) + 1;
      }
      
      writeJSON('invoicedb.json', db);
      res.status(201).json(invoice);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/invoices/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (supabase) {
      const { data: existing, error: fetchErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr || !existing) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Merge patched fields
      const mergedCustomerData = req.body.customer !== undefined ? req.body.customer : existing.customer_data;
      const mergedItems = req.body.items !== undefined ? req.body.items : existing.items;
      const mergedDetails = req.body.invoiceDetails !== undefined ? req.body.invoiceDetails : existing.invoice_details;
      const mergedTotal = req.body.totalAmount !== undefined ? parseFloat(req.body.totalAmount) : existing.total_amount;

      // Handle cancel status
      if (req.body.status) {
        mergedDetails.status = req.body.status;
      }

      const { error: updateErr } = await supabase.from('invoices').update({
        customer_data: mergedCustomerData,
        items: mergedItems,
        invoice_details: mergedDetails,
        total_amount: mergedTotal
      }).eq('id', id);

      if (updateErr) throw updateErr;
      res.status(200).json({ id, ...req.body });
    } else {
      const db = readJSON('invoicedb.json');
      const index = db.invoices.findIndex(inv => inv.id === id);
      if (index > -1) {
        db.invoices[index] = { ...db.invoices[index], ...req.body };
        writeJSON('invoicedb.json', db);
        res.status(200).json(db.invoices[index]);
      } else {
        res.status(404).json({ error: 'Invoice not found' });
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SETTINGS API ---
app.get('/settings', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'invoice_settings')
        .maybeSingle();
      if (error) throw error;
      res.json(data?.value || {});
    } else {
      const db = readJSON('invoicedb.json');
      res.json(db.settings || {});
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/settings', async (req, res) => {
  try {
    if (supabase) {
      const { data: existing } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'invoice_settings')
        .maybeSingle();
      const existingValue = existing?.value || {};
      const newValue = { ...existingValue, ...req.body };

      const { error } = await supabase.from('settings').upsert({
        key: 'invoice_settings',
        value: newValue
      });
      if (error) throw error;
      res.json({ message: 'Settings updated' });
    } else {
      const db = readJSON('invoicedb.json');
      db.settings = { ...db.settings, ...req.body };
      writeJSON('invoicedb.json', db);
      res.json({ message: 'Settings updated' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PDF & WORD STORAGE (Stateless Memory Upload for Serverless support) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/save-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const { date, invoiceNo } = req.body;
    const fy = getFinancialYear(date || new Date().toISOString());
    const month = getMonthFolderName(date || new Date().toISOString());

    if (supabase) {
      // Upload to Supabase Storage Bucket named 'invoices'
      const filePath = `${fy}/${month}/Bill_No_${invoiceNo}.pdf`;
      const { data, error } = await supabase.storage
        .from('invoices')
        .upload(filePath, req.file.buffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath);
      res.json({ message: 'PDF saved to Supabase Storage', path: urlData.publicUrl });
    } else {
      // Local fallback
      const dir = path.join(__dirname, 'invoices', fy, month);
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `Bill No ${invoiceNo}.pdf`);
      fs.writeFileSync(filePath, req.file.buffer);
      res.json({ message: 'PDF saved locally', path: filePath });
    }
  } catch (e) {
    console.error("Save PDF error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/save-word-report', async (req, res) => {
  try {
    const { html, monthStr } = req.body;
    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${html}</body></html>`;
    const fy = getFinancialYear(new Date().toISOString());

    if (supabase) {
      // Upload to Supabase Storage Bucket
      const filePath = `${fy}/Reports/Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`;
      const { data, error } = await supabase.storage
        .from('invoices')
        .upload(filePath, Buffer.from(wordHtml, 'utf8'), {
          contentType: 'application/msword',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath);
      res.json({ message: 'Report saved to Supabase Storage', path: urlData.publicUrl });
    } else {
      // Local fallback
      const dir = path.join(__dirname, 'invoices', fy, 'Reports');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`);
      fs.writeFileSync(filePath, wordHtml, 'utf8');
      res.json({ message: 'Report saved locally', path: filePath });
    }
  } catch (e) {
    console.error("Save Report error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- AUTH API ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true, message: 'Logged in successfully' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Local Billing Server running on port ${port}`);
});
