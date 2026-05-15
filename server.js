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

// Supabase Initialization
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Memory storage for uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
  const { data, error } = await supabase.from('customers').select('*');
  if (error) return res.status(500).json(error);
  res.json(data || []);
});

app.post('/customers', async (req, res) => {
  const { data, error } = await supabase.from('customers').upsert(req.body).select();
  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

// --- PRODUCTS API ---
app.get('/products', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*');
  if (error) return res.status(500).json(error);
  res.json(data || []);
});

app.post('/products', async (req, res) => {
  const { data, error } = await supabase.from('products').upsert(req.body).select();
  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

// --- INVOICES API ---
app.get('/invoices', async (req, res) => {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json(error);
  
  // Map Supabase fields to the format the frontend expects
  const mappedData = data.map(inv => ({
    id: inv.id,
    customer: inv.customer_data,
    items: inv.items,
    invoiceDetails: inv.invoice_details,
    totalAmount: inv.total_amount,
    createdAt: inv.created_at
  }));
  res.json(mappedData);
});

app.post('/invoices', async (req, res) => {
  const inv = req.body;
  const { data, error } = await supabase.from('invoices').insert({
    id: inv.id || Date.now().toString(),
    customer_id: inv.customer?.id,
    customer_data: inv.customer,
    items: inv.items,
    invoice_details: inv.invoiceDetails,
    total_amount: inv.totalAmount || 0
  }).select();
  
  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

// --- SETTINGS API ---
app.get('/settings', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) return res.status(500).json(error);
  const settings = {};
  data.forEach(s => settings[s.key] = s.value);
  res.json(settings);
});

app.patch('/settings', async (req, res) => {
  const updates = req.body;
  for (const key in updates) {
    await supabase.from('settings').upsert({ key, value: updates[key] });
  }
  res.json({ message: 'Settings updated' });
});

// --- PDF & WORD STORAGE ---

app.post('/api/save-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const { invoiceNo, date } = req.body;
  const fy = getFinancialYear(date || new Date().toISOString());
  const month = getMonthFolderName(date || new Date().toISOString());
  const filePath = `${fy}/${month}/Bill No ${invoiceNo}.pdf`;

  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(filePath, req.file.buffer, { contentType: 'application/pdf', upsert: true });

  if (error) return res.status(500).json(error);
  res.json({ message: 'PDF saved to cloud', path: data.path });
});

app.post('/api/save-word-report', async (req, res) => {
  const { html, monthStr } = req.body;
  const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${html}</body></html>`;
  
  const fy = getFinancialYear(new Date().toISOString());
  const filePath = `${fy}/Reports/Report_${monthStr.replace(' ', '_')}_${Date.now()}.doc`;

  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(filePath, Buffer.from(wordHtml), { contentType: 'application/msword', upsert: true });

  if (error) return res.status(500).json(error);
  res.json({ message: 'Report saved to cloud', path: data.path });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Professional Free Billing Server running on port ${port}`);
});
