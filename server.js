import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Helper to read/write JSON files
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
app.get('/customers', (req, res) => {
  try {
    const db = readJSON('customerdb.json');
    res.json(db.customers || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/customers', (req, res) => {
  try {
    const db = readJSON('customerdb.json');
    const customer = req.body;
    const index = db.customers.findIndex(c => c.id === customer.id);
    if (index > -1) {
      db.customers[index] = customer;
    } else {
      db.customers.push(customer);
    }
    writeJSON('customerdb.json', db);
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PRODUCTS API ---
app.get('/products', (req, res) => {
  try {
    const db = readJSON('productdb.json');
    res.json(db.products || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/products', (req, res) => {
  try {
    const db = readJSON('productdb.json');
    const product = req.body;
    const index = db.products.findIndex(p => p.id === product.id);
    if (index > -1) {
      db.products[index] = product;
    } else {
      db.products.push(product);
    }
    writeJSON('productdb.json', db);
    res.status(201).json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- INVOICES API ---
app.get('/invoices', (req, res) => {
  try {
    const db = readJSON('invoicedb.json');
    res.json(db.invoices || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/invoices', (req, res) => {
  try {
    const db = readJSON('invoicedb.json');
    const invoice = req.body;
    db.invoices.push(invoice);
    
    // Update next invoice number
    if (db.settings) {
      db.settings.nextInvoiceNo = (parseInt(invoice.invoiceDetails?.invoiceNo) || 0) + 1;
    }
    
    writeJSON('invoicedb.json', db);
    res.status(201).json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SETTINGS API ---
app.get('/settings', (req, res) => {
  try {
    const db = readJSON('invoicedb.json');
    res.json(db.settings || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/settings', (req, res) => {
  try {
    const db = readJSON('invoicedb.json');
    db.settings = { ...db.settings, ...req.body };
    writeJSON('invoicedb.json', db);
    res.json({ message: 'Settings updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PDF & WORD STORAGE ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { date } = req.body;
    const fy = getFinancialYear(date || new Date().toISOString());
    const month = getMonthFolderName(date || new Date().toISOString());
    const dir = path.join(__dirname, 'invoices', fy, month);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const { invoiceNo } = req.body;
    cb(null, `Bill No ${invoiceNo}.pdf`);
  }
});
const upload = multer({ storage: storage });

app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ message: 'PDF saved locally', path: req.file.path });
});

app.post('/api/save-word-report', (req, res) => {
  const { html, monthStr } = req.body;
  const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${html}</body></html>`;
  
  const fy = getFinancialYear(new Date().toISOString());
  const dir = path.join(__dirname, 'invoices', fy, 'Reports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`);

  fs.writeFileSync(filePath, wordHtml, 'utf8');
  res.json({ message: 'Report saved locally', path: filePath });
});

app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Local Billing Server running on port ${port}`);
});
