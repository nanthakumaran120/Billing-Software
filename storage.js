import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');

// Temporary in-memory cache to handle crash prevention on read-only filesystems (Vercel)
const memoryCache = {};

// Helper to read JSON file safely with local persistence as primary and memory as fallback
const readJSON = (file) => {
  if (memoryCache[file]) {
    return memoryCache[file];
  }
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DB_PATH, file), 'utf8'));
    memoryCache[file] = data;
    return data;
  } catch (e) {
    console.error(`Error reading local database file ${file}:`, e.message);
    // If file doesn't exist or is unreadable, default structures:
    const defaultStructure = file === 'customerdb.json' ? { customers: [] }
                           : file === 'productdb.json' ? { products: [] }
                           : { invoices: [], settings: {} };
    memoryCache[file] = defaultStructure;
    return defaultStructure;
  }
};

// Helper to write JSON file safely, using in-memory updates if disk write is blocked
const writeJSON = (file, data) => {
  memoryCache[file] = data;
  try {
    fs.writeFileSync(path.join(DB_PATH, file), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn(`Warning: Could not write database file ${file} to disk (read-only filesystem on serverless/Vercel). Falling back to ephemeral in-memory storage. Error:`, e.message);
  }
};

/**
 * Pluggable Future-Ready Storage Abstraction Layer.
 * To switch to Supabase/Firebase/MongoDB in the future:
 * Change only the implementation of the functions below.
 * All Express routes and frontend logic will remain completely untouched.
 */
export const storageService = {
  // --- CUSTOMERS ---
  async getCustomers() {
    const db = readJSON('customerdb.json');
    return db.customers || [];
  },

  async saveCustomer(customer) {
    const db = readJSON('customerdb.json');
    if (!db.customers) db.customers = [];
    
    const index = db.customers.findIndex(c => String(c.id) === String(customer.id));
    if (index > -1) {
      db.customers[index] = customer;
    } else {
      db.customers.push(customer);
    }
    
    writeJSON('customerdb.json', db);
    return customer;
  },

  // --- PRODUCTS ---
  async getProducts() {
    const db = readJSON('productdb.json');
    return db.products || [];
  },

  async saveProduct(product) {
    const db = readJSON('productdb.json');
    if (!db.products) db.products = [];
    
    const index = db.products.findIndex(p => String(p.id) === String(product.id));
    if (index > -1) {
      db.products[index] = product;
    } else {
      db.products.push(product);
    }
    
    writeJSON('productdb.json', db);
    return product;
  },

  // --- INVOICES ---
  async getInvoices() {
    const db = readJSON('invoicedb.json');
    return db.invoices || [];
  },

  async saveInvoice(invoice) {
    const db = readJSON('invoicedb.json');
    if (!db.invoices) db.invoices = [];
    
    db.invoices.push(invoice);
    
    // Automatically update the next invoice number sequence if settings are loaded
    if (db.settings) {
      db.settings.nextInvoiceNo = (parseInt(invoice.invoiceDetails?.invoiceNo) || 0) + 1;
    }
    
    writeJSON('invoicedb.json', db);
    return invoice;
  },

  async updateInvoice(id, updates) {
    const db = readJSON('invoicedb.json');
    if (!db.invoices) db.invoices = [];
    
    const index = db.invoices.findIndex(inv => String(inv.id) === String(id));
    if (index > -1) {
      db.invoices[index] = { ...db.invoices[index], ...updates };
      writeJSON('invoicedb.json', db);
      return db.invoices[index];
    } else {
      throw new Error('Invoice not found');
    }
  },

  // --- SETTINGS ---
  async getSettings() {
    const db = readJSON('invoicedb.json');
    return db.settings || {};
  },

  async saveSettings(updates) {
    const db = readJSON('invoicedb.json');
    db.settings = { ...db.settings, ...updates };
    writeJSON('invoicedb.json', db);
    return db.settings;
  }
};
