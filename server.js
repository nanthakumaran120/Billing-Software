import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

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

// Configure SQLite DB path safely (compatible with writable Electron userData folder)
const DB_DIR = process.env.SQLITE_DB_DIR || path.join(__dirname, 'data');
const JSON_DB_DIR = process.env.JSON_DB_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_FILE = path.join(DB_DIR, 'billing.db');

let db;
try {
  db = new Database(DB_FILE);
  console.log(`SQLite database successfully initialized at: ${DB_FILE}`);
} catch (err) {
  console.warn("SQLite database failed to mount locally. Falling back to in-memory SQLite:", err.message);
  db = new Database(':memory:');
}

// 1. Create SQLite schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS Customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    gstin TEXT,
    state TEXT,
    stateCode TEXT
  );
  
  CREATE TABLE IF NOT EXISTS Products (
    id TEXT PRIMARY KEY,
    description TEXT,
    hsn TEXT,
    rate TEXT,
    per TEXT
  );
  
  CREATE TABLE IF NOT EXISTS Invoices (
    id TEXT PRIMARY KEY,
    invoiceNo INTEGER,
    date TEXT,
    customerName TEXT,
    invoiceDetails TEXT,
    customer TEXT,
    items TEXT,
    status TEXT DEFAULT 'active',
    cancelledAt TEXT,
    cancellationReason TEXT,
    createdAt TEXT
  );
  
  CREATE TABLE IF NOT EXISTS Settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 2. JSON-to-SQLite Automatic Migration Script on first run
const runMigrations = async () => {
  try {
    // A. Migrate Customers
    const customerCount = db.prepare("SELECT COUNT(*) as count FROM Customers").get().count;
    if (customerCount === 0) {
      const customerJSONPath = path.join(JSON_DB_DIR, 'customerdb.json');
      if (fs.existsSync(customerJSONPath)) {
        const raw = fs.readFileSync(customerJSONPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.customers && Array.isArray(data.customers)) {
          const insert = db.prepare("INSERT OR REPLACE INTO Customers (id, name, address, gstin, state, stateCode) VALUES (?, ?, ?, ?, ?, ?)");
          const insertMany = db.transaction((custs) => {
            for (const c of custs) {
              insert.run(c.id || '', c.name || '', c.address || '', c.gstin || '', c.state || '', c.stateCode || '');
            }
          });
          insertMany(data.customers);
          console.log(`Auto-Migrated ${data.customers.length} Customers into SQLite.`);
        }
      }
    }

    // B. Migrate Products
    const productCount = db.prepare("SELECT COUNT(*) as count FROM Products").get().count;
    if (productCount === 0) {
      const productJSONPath = path.join(JSON_DB_DIR, 'productdb.json');
      if (fs.existsSync(productJSONPath)) {
        const raw = fs.readFileSync(productJSONPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.products && Array.isArray(data.products)) {
          const insert = db.prepare("INSERT OR REPLACE INTO Products (id, description, hsn, rate, per) VALUES (?, ?, ?, ?, ?)");
          const insertMany = db.transaction((prods) => {
            for (const p of prods) {
              insert.run(p.id || '', p.description || '', p.hsn || '', p.rate !== undefined && p.rate !== null ? String(p.rate) : '', p.per || '');
            }
          });
          insertMany(data.products);
          console.log(`Auto-Migrated ${data.products.length} Products into SQLite.`);
        }
      }
    }

    // C. Migrate Invoices & Settings
    const invoiceCount = db.prepare("SELECT COUNT(*) as count FROM Invoices").get().count;
    if (invoiceCount === 0) {
      const invoiceJSONPath = path.join(JSON_DB_DIR, 'invoicedb.json');
      if (fs.existsSync(invoiceJSONPath)) {
        const raw = fs.readFileSync(invoiceJSONPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.invoices && Array.isArray(data.invoices)) {
          const insert = db.prepare(`
            INSERT OR REPLACE INTO Invoices 
            (id, invoiceNo, date, customerName, invoiceDetails, customer, items, status, cancelledAt, cancellationReason, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const insertMany = db.transaction((invs) => {
            for (const inv of invs) {
              insert.run(
                inv.id || String(Date.now()),
                parseInt(inv.invoiceDetails?.invoiceNo) || 0,
                inv.invoiceDetails?.date || '',
                inv.customer?.name || '',
                JSON.stringify(inv.invoiceDetails || {}),
                JSON.stringify(inv.customer || {}),
                JSON.stringify(inv.items || []),
                inv.status || 'active',
                inv.cancelledAt || null,
                inv.cancellationReason || '',
                inv.createdAt || ''
              );
            }
          });
          insertMany(data.invoices);
          console.log(`Auto-Migrated ${data.invoices.length} Invoices into SQLite.`);
        }

        if (data.settings) {
          const insertSetting = db.prepare("INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)");
          db.transaction(() => {
            insertSetting.run('nextInvoiceNo', String(data.settings.nextInvoiceNo || 1));
            insertSetting.run('financialYear', data.settings.financialYear || '');
          })();
          console.log("Auto-Migrated global sequences settings into SQLite.");
        }
      }
    }
  } catch (err) {
    console.error("Auto-Migration error during database load:", err);
  }
};

runMigrations();

// 3. In-memory caching optimization (Customers, Products, Settings)
const cache = {
  customers: null,
  products: null,
  settings: null
};

const getCachedCustomers = () => {
  if (cache.customers) return cache.customers;
  const rows = db.prepare("SELECT * FROM Customers ORDER BY name ASC").all();
  cache.customers = rows;
  return rows;
};

const getCachedProducts = () => {
  if (cache.products) return cache.products;
  const rows = db.prepare("SELECT * FROM Products ORDER BY description ASC").all();
  cache.products = rows;
  return rows;
};

const getCachedSettings = () => {
  if (cache.settings) return cache.settings;
  const rows = db.prepare("SELECT * FROM Settings").all();
  const settingsObj = {};
  for (const row of rows) {
    if (row.key === 'nextInvoiceNo') {
      settingsObj.nextInvoiceNo = parseInt(row.value) || 1;
    } else {
      settingsObj[row.key] = row.value;
    }
  }
  cache.settings = settingsObj;
  return settingsObj;
};

const clearCustomersCache = () => { cache.customers = null; };
const clearProductsCache = () => { cache.products = null; };
const clearSettingsCache = () => { cache.settings = null; };


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
    res.json(getCachedCustomers());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/customers', (req, res) => {
  try {
    const customer = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO Customers (id, name, address, gstin, state, stateCode) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(customer.id, customer.name, customer.address, customer.gstin, customer.state, customer.stateCode);
    clearCustomersCache();
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PRODUCTS API ---
app.get('/products', (req, res) => {
  try {
    res.json(getCachedProducts());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/products', (req, res) => {
  try {
    const product = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO Products (id, description, hsn, rate, per) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(product.id, product.description, product.hsn, product.rate ? String(product.rate) : '', product.per);
    clearProductsCache();
    res.status(201).json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- INVOICES API ---
app.get('/invoices', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM Invoices ORDER BY invoiceNo ASC").all();
    const invoices = rows.map(row => ({
      id: row.id,
      invoiceDetails: JSON.parse(row.invoiceDetails),
      customer: JSON.parse(row.customer),
      items: JSON.parse(row.items),
      status: row.status,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt
    }));
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/invoices', (req, res) => {
  try {
    const invoice = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO Invoices 
      (id, invoiceNo, date, customerName, invoiceDetails, customer, items, status, cancelledAt, cancellationReason, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      invoice.id,
      parseInt(invoice.invoiceDetails?.invoiceNo) || 0,
      invoice.invoiceDetails?.date || '',
      invoice.customer?.name || '',
      JSON.stringify(invoice.invoiceDetails || {}),
      JSON.stringify(invoice.customer || {}),
      JSON.stringify(invoice.items || []),
      invoice.status || 'active',
      invoice.cancelledAt || null,
      invoice.cancellationReason || '',
      invoice.createdAt || ''
    );
    
    // Update next invoice number in Settings database
    const nextNo = (parseInt(invoice.invoiceDetails?.invoiceNo) || 0) + 1;
    db.prepare("INSERT OR REPLACE INTO Settings (key, value) VALUES ('nextInvoiceNo', ?)").run(String(nextNo));
    clearSettingsCache();

    res.status(201).json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/invoices/:id', (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    
    const existing = db.prepare("SELECT * FROM Invoices WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const updatedStatus = body.status !== undefined ? body.status : existing.status;
    const updatedCancelledAt = body.cancelledAt !== undefined ? body.cancelledAt : existing.cancelledAt;
    const updatedReason = body.cancellationReason !== undefined ? body.cancellationReason : existing.cancellationReason;

    db.prepare(`
      UPDATE Invoices 
      SET status = ?, cancelledAt = ?, cancellationReason = ?
      WHERE id = ?
    `).run(updatedStatus, updatedCancelledAt, updatedReason, id);

    const row = db.prepare("SELECT * FROM Invoices WHERE id = ?").get(id);
    res.status(200).json({
      id: row.id,
      invoiceDetails: JSON.parse(row.invoiceDetails),
      customer: JSON.parse(row.customer),
      items: JSON.parse(row.items),
      status: row.status,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SETTINGS API ---
app.get('/settings', (req, res) => {
  try {
    res.json(getCachedSettings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/settings', (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)");
    db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v));
      }
    })();
    clearSettingsCache();
    res.json({ message: 'Settings updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PDF & WORD STORAGE (Completely Async File System) ---
const baseInvoicePath = process.env.INVOICE_STORAGE_PATH || path.join(__dirname, 'invoices');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/save-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const { invoiceNo, date } = req.body;
    const pdfBuffer = req.file.buffer;

    let invoiceRoot = "D:\\New folder\\billing\\invoices";
    if (!fs.existsSync(invoiceRoot)) {
      const cwdPath = path.join(process.cwd(), "invoices");
      const unpackedPath = path.join(process.cwd(), "..", "..", "invoices");
      if (fs.existsSync(unpackedPath)) {
        invoiceRoot = unpackedPath;
      } else {
        invoiceRoot = cwdPath;
      }
    }

    const financialYear = "26-27";

    const dateStr = date || new Date().toISOString().split('T')[0];
    const d = new Date(dateStr);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[d.getMonth()];
    const monthNumber = d.getMonth() + 1;
    const yearShort = d.getFullYear().toString().slice(-2);

    const monthFolder =
      `${monthNumber}-${monthName}-${yearShort}`;

    const targetFolder =
      path.join(
        invoiceRoot,
        financialYear,
        monthFolder
      );

    if (
      !fs.existsSync(targetFolder)
    ) {
      fs.mkdirSync(
        targetFolder,
        { recursive: true }
      );
    }

    const fileName =
      `Bill No ${invoiceNo}.pdf`;

    const fullPath =
      path.join(
        targetFolder,
        fileName
      );

    await fs.promises.writeFile(
      fullPath,
      pdfBuffer
    );

    console.log(
      "Saved:",
      fullPath
    );

    res.json({ message: 'PDF saved successfully', path: fullPath });
  } catch (error) {
    console.error(
      "Invoice Save Failed:",
      error
    );
    res.status(500).json({ error: 'Failed to save invoice', details: error.message });
  }
});

app.post('/api/save-word-report', async (req, res) => {
  try {
    const { html, monthStr } = req.body;
    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${html}</body></html>`;
    
    const fy = getFinancialYear(new Date().toISOString());
    let dir = path.join(baseInvoicePath, fy, 'Reports');
    let isServerless = false;
    try {
      await fsPromises.mkdir(dir, { recursive: true });
    } catch (mkdirError) {
      console.warn("Falling back to /tmp directory for Word report storage in serverless space:", mkdirError.message);
      dir = path.join('/tmp', 'invoices', fy, 'Reports');
      await fsPromises.mkdir(dir, { recursive: true });
      isServerless = true;
    }
    const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`);

    await fsPromises.writeFile(filePath, wordHtml, 'utf8');
    res.json({ message: isServerless ? 'Report saved in serverless ephemeral storage' : 'Report saved locally', path: filePath });
  } catch (error) {
    console.error("Error saving Word report:", error);
    res.status(500).json({ error: 'Failed to save Word report', details: error.message });
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

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Local Billing Server running on port ${port}`);
  });
}

export default app;
