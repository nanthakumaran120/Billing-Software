import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { storageService } from './storage.js';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'dist')));

// Prevent caching for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/customers' || req.path === '/products' || req.path === '/invoices' || req.path === '/settings') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

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
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[d.getMonth()];
  const month = d.getMonth() + 1;
  const year2 = d.getFullYear().toString().slice(-2);
  return `${month}-${monthName}-${year2}`;
};

// --- CUSTOMERS API ---
app.get(['/customers', '/api/customers'], async (req, res) => {
  try {
    const customers = await storageService.getCustomers();
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(['/customers', '/api/customers'], async (req, res) => {
  try {
    const customer = await storageService.saveCustomer(req.body);
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PRODUCTS API ---
app.get(['/products', '/api/products'], async (req, res) => {
  try {
    const products = await storageService.getProducts();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(['/products', '/api/products'], async (req, res) => {
  try {
    const product = await storageService.saveProduct(req.body);
    res.status(201).json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- INVOICES API ---
app.get(['/invoices', '/api/invoices'], async (req, res) => {
  try {
    const invoices = await storageService.getInvoices();
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(['/invoices', '/api/invoices'], async (req, res) => {
  try {
    const invoice = await storageService.saveInvoice(req.body);
    res.status(201).json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(['/invoices/:id', '/api/invoices/:id'], async (req, res) => {
  try {
    const updatedInvoice = await storageService.updateInvoice(req.params.id, req.body);
    res.status(200).json(updatedInvoice);
  } catch (e) {
    if (e.message === 'Invoice not found') {
      res.status(404).json({ error: e.message });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// --- SETTINGS API ---
app.get(['/settings', '/api/settings'], async (req, res) => {
  try {
    const settings = await storageService.getSettings();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(['/settings', '/api/settings'], async (req, res) => {
  try {
    await storageService.saveSettings(req.body);
    res.json({ message: 'Settings updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PDF & WORD STORAGE ---
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { date } = req.body;
      const fy = getFinancialYear(date || new Date().toISOString());
      const month = getMonthFolderName(date || new Date().toISOString());
      let dir = path.join(process.cwd(), 'invoices', fy, month);
      try {
        fs.mkdirSync(dir, { recursive: true });
        req.isServerless = false;
      } catch (mkdirError) {
        console.warn("Falling back to /tmp directory for PDF storage on serverless environment (Vercel):", mkdirError.message);
        dir = path.join('/tmp', 'invoices', fy, month);
        fs.mkdirSync(dir, { recursive: true });
        req.isServerless = true;
      }
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const { invoiceNo } = req.body;
    cb(null, `Bill No ${invoiceNo}.pdf`);
  }
});
const upload = multer({ storage: uploadStorage });

app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ 
    message: req.isServerless ? 'PDF saved in serverless ephemeral storage' : 'PDF saved successfully', 
    path: req.file.path,
    isServerless: req.isServerless || false
  });
});

app.post('/api/save-word-report', (req, res) => {
  try {
    const { html, monthStr } = req.body;
    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${html}</body></html>`;
    
    const fy = getFinancialYear(new Date().toISOString());
    let dir = path.join(process.cwd(), 'invoices', fy, 'Reports');
    let isServerless = false;
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (mkdirError) {
      console.warn("Falling back to /tmp directory for Word report storage on serverless environment (Vercel):", mkdirError.message);
      dir = path.join('/tmp', 'invoices', fy, 'Reports');
      fs.mkdirSync(dir, { recursive: true });
      isServerless = true;
    }
    const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`);

    fs.writeFileSync(filePath, wordHtml, 'utf8');
    res.json({ message: isServerless ? 'Report saved in serverless ephemeral storage' : 'Report saved locally', path: filePath });
  } catch (error) {
    console.error("Error saving Word report:", error);
    res.status(500).json({ error: 'Failed to save Word report', details: error.message });
  }
});

// --- AUTH API ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Simple hardcoded check for now, can be changed later
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true, message: 'Logged in successfully' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// --- LIGHTWEIGHT TEST ENDPOINT ---
app.get('/api/test', (req, res) => {
  res.json({
    status: "ok"
  });
});

app.get(/^(.*)$/, (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Vite dist assets not found. Ensure production build compiled correctly.');
    }
  } catch (error) {
    console.error("Static file delivery crash:", error);
    res.status(500).send("Static file delivery error: " + error.message);
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
}

export default app;
