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
app.use(express.json());

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

app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No PDF file uploaded.');
  }
  console.log(`Successfully saved PDF to ${req.file.path}`);
  res.status(200).json({ message: 'PDF saved successfully', path: req.file.path });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
