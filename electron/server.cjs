const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const month = d.getMonth() + 1;
  const monthName = monthNames[d.getMonth()];
  const year2 = d.getFullYear().toString().slice(-2);
  return `${month}-${monthName}-${year2}`;
};

// In production (Electron), INVOICE_STORAGE_PATH is set to a writable Documents subfolder.
// In development, invoices are stored locally in the project's ./invoices folder.
const baseInvoicePath = process.env.INVOICE_STORAGE_PATH || path.join(__dirname, '..', 'invoices');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateStr = req.body.date || new Date().toISOString();
    const fyFolder = getFinancialYear(dateStr);
    const monthFolder = getMonthFolderName(dateStr);
    const dir = path.join(baseInvoicePath, fyFolder, monthFolder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const invoiceNo = req.body.invoiceNo || 'Unknown';
    cb(null, `Bill No ${invoiceNo}.pdf`);
  }
});

const upload = multer({ storage: storage });

app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No PDF file uploaded.');
  }
  console.log(`Successfully saved PDF to ${req.file.path}`);
  res.status(200).json({ message: 'PDF saved successfully', path: req.file.path });
});

app.post('/api/save-word-report', (req, res) => {
  try {
    const { html, monthStr } = req.body;
    if (!html || !monthStr) return res.status(400).send('Missing html or monthStr');

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

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
