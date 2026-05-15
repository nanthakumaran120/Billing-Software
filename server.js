import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  const month = d.getMonth() + 1;
  const monthName = monthNames[d.getMonth()];
  const year2 = d.getFullYear().toString().slice(-2);
  // Format: 4-April-26
  return `${month}-${monthName}-${year2}`;
};

// Set up storage for multer
// In production (Electron), INVOICE_STORAGE_PATH is set to a writable Documents subfolder.
// In development, invoices are stored locally in the project's ./invoices folder.
const baseInvoicePath = process.env.INVOICE_STORAGE_PATH || path.join(__dirname, 'invoices');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateStr = req.body.date || new Date().toISOString();
    const fyFolder = getFinancialYear(dateStr);
    const monthFolder = getMonthFolderName(dateStr);

    const dir = path.join(baseInvoicePath, fyFolder, monthFolder);

    // Create the directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const invoiceNo = req.body.invoiceNo || 'Unknown';
    // Replacing colon from 'Bill No :1' to 'Bill No 1' as Windows doesn't allow colons in filenames
    cb(null, `Bill No ${invoiceNo}.pdf`);
  }
});

const upload = multer({ storage: storage });

const autoGenerateWordReportForDate = (dateStr) => {
    try {
        const d = new Date(dateStr);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

        const fyFolder = getFinancialYear(dateStr);
        const monthFolder = getMonthFolderName(dateStr);
        const dir = path.join(baseInvoicePath, fyFolder, monthFolder);

        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}.doc`);

        // INVOICE_DB must be declared above if we use it here.
        // It's declared below. Let me just use path.join(__dirname, 'invoicedb.json')
        const invoiceDbPath = path.join(__dirname, 'invoicedb.json');
        let data = { invoices: [] };
        if (fs.existsSync(invoiceDbPath)) {
            data = JSON.parse(fs.readFileSync(invoiceDbPath, 'utf8') || '{"invoices":[]}');
        }
        const invoices = data.invoices || [];

        const filteredInvoices = invoices.filter(inv => {
            if (!inv.invoiceDetails || !inv.invoiceDetails.date) return false;
            const idate = new Date(inv.invoiceDetails.date);
            return idate.getMonth() === d.getMonth() && idate.getFullYear() === d.getFullYear();
        });

        filteredInvoices.sort((a, b) => {
            const numA = parseInt(a.invoiceDetails.invoiceNo) || 0;
            const numB = parseInt(b.invoiceDetails.invoiceNo) || 0;
            return numA - numB;
        });

        const formatCurrency = (amount) => Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const d2 = new Date(dateString);
            return `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}/${d2.getFullYear()}`;
        };

        let rowsHtml = '';
        let totalSub = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalAmt = 0;

        if (filteredInvoices.length === 0) {
            rowsHtml = `<tr><td colspan="10" style="border: 1px solid black; padding: 5px; text-align: center;">No invoices found.</td></tr>`;
        } else {
            filteredInvoices.forEach((inv, index) => {
                const items = inv.items || [];
                const customer = inv.customer || {};
                const stateCode = customer.stateCode || '';
                
                const subtotal = items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
                const isIntraState = stateCode === '33';
                const cgst = isIntraState ? subtotal * 0.025 : 0;
                const sgst = isIntraState ? subtotal * 0.025 : 0;
                const igst = !isIntraState ? subtotal * 0.05 : 0;
                const totalAmount = Math.round(subtotal + cgst + sgst + igst);

                totalSub += subtotal; totalCgst += cgst; totalSgst += sgst; totalIgst += igst; totalAmt += totalAmount;

                rowsHtml += `
                    <tr>
                        <td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid black; padding: 5px;">${customer.gstin || '-'}</td>
                        <td style="border: 1px solid black; padding: 5px; font-weight: bold;">${customer.name || '-'}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: center;">${inv.invoiceDetails.invoiceNo || '-'}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: center;">${formatDate(inv.invoiceDetails.date)}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: right;">${formatCurrency(subtotal)}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: right;">${formatCurrency(cgst)}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: right;">${formatCurrency(sgst)}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: right;">${formatCurrency(igst)}</td>
                        <td style="border: 1px solid black; padding: 5px; text-align: right; font-weight: bold;">${formatCurrency(totalAmount)}</td>
                    </tr>
                `;
            });
        }

        const htmlString = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>Monthly Report</title>
                <style>
                    @page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 36.0pt 36.0pt 36.0pt 36.0pt; }
                    div.WordSection1 { page: WordSection1; }
                    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
                    th, td { border: 1px solid black; padding: 6px; }
                    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
                </style>
            </head>
            <body>
            <div class="WordSection1">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #1e3a8a; font-family: Arial, sans-serif; font-size: 24px; margin: 0;">SRINIVASA DYEING</h1>
                    <p style="font-family: Arial, sans-serif; font-weight: bold; font-size: 12px; margin: 5px 0;">DYEING &amp; CLOTH MERCHANT</p>
                    <p style="font-family: Arial, sans-serif; font-size: 10px; margin: 0;">22, Kattur Road, C.S. Puram P.O., 637 401, Rasipuram Tk, Namakkal Dt, Tamil Nadu</p>
                    <p style="font-family: Arial, sans-serif; font-weight: bold; font-size: 12px; margin: 5px 0;">GSTIN: 33AKQPA9652A1ZD</p>
                </div>
                
                <table style="width: 100%; border: none; margin-bottom: 10px; font-family: Arial, sans-serif;">
                    <tr>
                        <td style="border: none; text-align: left;">
                            <strong style="font-size: 14px;">MONTHLY SALES / GST REPORT (GSTR-2B Format)</strong><br/>
                            Statement for the month of: ${monthStr}
                        </td>
                        <td style="border: none; text-align: right; vertical-align: bottom;">
                            Date of Generation: ${formatDate(new Date().toISOString())}
                        </td>
                    </tr>
                </table>

                <table border="1" cellpadding="5" cellspacing="0" style="border: 2px solid black; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #e5e7eb;">
                            <th>S.No</th>
                            <th>GSTIN of supplier/buyer</th>
                            <th>Trade/Legal name</th>
                            <th>Invoice No</th>
                            <th>Invoice Date</th>
                            <th>Taxable Value (Rs)</th>
                            <th>Central Tax (Rs)</th>
                            <th>State/UT Tax (Rs)</th>
                            <th>IGST (Rs)</th>
                            <th>Invoice Value (Rs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    ${filteredInvoices.length > 0 ? `
                    <tfoot>
                        <tr style="background-color: #f9fafb; font-weight: bold;">
                            <td colspan="5" style="text-align: right; border: 1px solid black; padding: 5px;">TOTAL</td>
                            <td style="text-align: right; border: 1px solid black; padding: 5px;">${formatCurrency(totalSub)}</td>
                            <td style="text-align: right; border: 1px solid black; padding: 5px;">${formatCurrency(totalCgst)}</td>
                            <td style="text-align: right; border: 1px solid black; padding: 5px;">${formatCurrency(totalSgst)}</td>
                            <td style="text-align: right; border: 1px solid black; padding: 5px;">${formatCurrency(totalIgst)}</td>
                            <td style="text-align: right; border: 1px solid black; padding: 5px;">${formatCurrency(totalAmt)}</td>
                        </tr>
                    </tfoot>` : ''}
                </table>

                <br/><br/><br/>
                <table style="width: 100%; border: none; font-family: Arial, sans-serif; font-size: 12px; page-break-inside: avoid;">
                    <tr>
                        <td style="border: none; text-align: center; width: 33%;">
                            _____________________<br/>Prepared By
                        </td>
                        <td style="border: none; text-align: center; width: 33%;">
                            _____________________<br/>Audited By / Auditor
                        </td>
                        <td style="border: none; text-align: center; width: 33%;">
                            <i>For SRINIVASA DYEING</i><br/><br/>_____________________<br/>Authorised Signatory
                        </td>
                    </tr>
                </table>
            </div>
            </body>
            </html>
        `;

        fs.writeFileSync(filePath, htmlString, 'utf8');
        console.log(`Auto-generated Word report: ${filePath}`);
    } catch (e) {
        console.error("Failed to auto generate word report:", e);
    }
};

app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No PDF file uploaded.');
  }
  console.log(`Successfully saved PDF to ${req.file.path}`);
  
  // Safely extract date before timeout
  const reportDateStr = req.body.date ? String(req.body.date) : new Date().toISOString();
  
  // Wait 1.5 seconds to absolutely ensure json-server has flushed invoicedb.json to disk
  setTimeout(() => {
    autoGenerateWordReportForDate(reportDateStr);
  }, 1500);

  res.status(200).json({ message: 'PDF saved successfully', path: req.file.path });
});

app.post('/api/save-word-report', (req, res) => {
  try {
    const { html, monthStr } = req.body; // e.g., monthStr = "May 2026"
    if (!html || !monthStr) {
      return res.status(400).send('Missing html or monthStr');
    }

    // Try to parse "May 2026" to generate the folder name. 
    let dir;
    if (monthStr === 'All_Months') {
        const fyFolder = getFinancialYear(new Date().toISOString());
        dir = path.join(baseInvoicePath, fyFolder, 'All_Months_Reports');
    } else {
        const dateObj = new Date(`1 ${monthStr}`);
        const dateStr = dateObj.toISOString();
        const fyFolder = getFinancialYear(dateStr);
        const monthFolder = getMonthFolderName(dateStr);
        dir = path.join(baseInvoicePath, fyFolder, monthFolder);
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, `Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`);
    
    // We wrap the HTML in basic Word-compatible tags
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Monthly Report</title></head>
      <body>${html}</body>
      </html>
    `;

    fs.writeFileSync(filePath, wordHtml, 'utf8');
    console.log(`Successfully saved Word report to ${filePath}`);
    res.status(200).json({ message: 'Report saved successfully', path: filePath });
  } catch (error) {
    console.error("Error saving word report:", error);
    res.status(500).json({ error: 'Failed to save word report' });
  }
});

// Database file paths
const CUSTOMER_DB = path.join(__dirname, 'customerdb.json');
const PRODUCT_DB = path.join(__dirname, 'productdb.json');
const INVOICE_DB = path.join(__dirname, 'invoicedb.json');

// Helper to read JSON
const readDB = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
};

// Helper to write JSON
const writeDB = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
};

// --- CUSTOMERS API ---
app.get('/customers', (req, res) => {
  const db = readDB(CUSTOMER_DB);
  res.json(db ? db.customers || [] : []);
});

app.post('/customers', (req, res) => {
  const db = readDB(CUSTOMER_DB) || { customers: [] };
  const newCustomer = req.body;
  if (!newCustomer.id) {
    newCustomer.id = `C${String(db.customers.length + 1).padStart(3, '0')}`;
  }
  db.customers.push(newCustomer);
  if (writeDB(CUSTOMER_DB, db)) {
    res.status(201).json(newCustomer);
  } else {
    res.status(500).json({ error: 'Failed to save customer' });
  }
});

// --- PRODUCTS API ---
app.get('/products', (req, res) => {
  const db = readDB(PRODUCT_DB);
  res.json(db ? db.products || [] : []);
});

app.post('/products', (req, res) => {
  const db = readDB(PRODUCT_DB) || { products: [] };
  const newProduct = req.body;
  if (!newProduct.id) {
    newProduct.id = `P${String(db.products.length + 1).padStart(3, '0')}`;
  }
  db.products.push(newProduct);
  if (writeDB(PRODUCT_DB, db)) {
    res.status(201).json(newProduct);
  } else {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

// --- INVOICES API ---
app.get('/invoices', (req, res) => {
  const db = readDB(INVOICE_DB);
  res.json(db ? db.invoices || [] : []);
});

app.post('/invoices', (req, res) => {
  const db = readDB(INVOICE_DB) || { invoices: [], settings: {} };
  const newInvoice = req.body;
  if (!newInvoice.id) {
    newInvoice.id = Date.now().toString();
  }
  if (!newInvoice.createdAt) {
    newInvoice.createdAt = new Date().toISOString();
  }
  db.invoices.push(newInvoice);
  if (writeDB(INVOICE_DB, db)) {
    res.status(201).json(newInvoice);
  } else {
    res.status(500).json({ error: 'Failed to save invoice' });
  }
});

// --- SETTINGS API ---
app.get('/settings', (req, res) => {
  const db = readDB(INVOICE_DB);
  res.json(db ? db.settings || {} : {});
});

app.patch('/settings', (req, res) => {
  const db = readDB(INVOICE_DB) || { invoices: [], settings: {} };
  const updates = req.body;
  db.settings = { ...db.settings, ...updates };
  if (writeDB(INVOICE_DB, db)) {
    res.json(db.settings);
  } else {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
