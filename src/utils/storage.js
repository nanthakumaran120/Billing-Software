const STORAGE_KEYS = {
  CUSTOMERS: 'billing_customers',
  PRODUCTS: 'billing_products',
  INVOICE_NO: 'billing_invoice_no'
};

const INITIAL_CUSTOMERS = [
  { id: 1, name: 'Sree Textiles', address: '12, Main St, Salem', gstin: '33AAAAA0000A1Z5', state: 'Tamil Nadu', stateCode: '33' },
  { id: 2, name: 'Kerala Fabrics', address: '45, High Rd, Cochin', gstin: '32BBBBB0000B1Z6', state: 'Kerala', stateCode: '32' }
];

const INITIAL_PRODUCTS = [
  { id: 1, description: 'Suda Towel 24 Katthu', hsn: '6304', rate: 61, per: 'Nos' },
  { id: 2, description: 'Cool White Towel 3 Katthu', hsn: '6304', rate: 58, per: 'Nos' },
  { id: 3, description: 'Cool White Flower Towel 15 Katthu', hsn: '6304', rate: 63.50, per: 'Nos' }
];

export const loadCustomers = () => {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  return data ? JSON.parse(data) : INITIAL_CUSTOMERS;
};

export const saveCustomer = (customer) => {
  const customers = loadCustomers();
  const index = customers.findIndex(c => c.name === customer.name);
  if (index >= 0) {
    customers[index] = customer;
  } else {
    customers.push({ ...customer, id: Date.now() });
  }
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
};

export const loadProducts = () => {
  const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  return data ? JSON.parse(data) : INITIAL_PRODUCTS;
};

export const saveProduct = (product) => {
  const products = loadProducts();
  const index = products.findIndex(p => p.description === product.description);
  if (index >= 0) {
    products[index] = product; // Update if exists
  } else {
    products.push({ ...product, id: Date.now() });
  }
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const getNextInvoiceNo = () => {
  const no = localStorage.getItem(STORAGE_KEYS.INVOICE_NO);
  return no ? parseInt(no, 10) : 371;
};

export const saveInvoiceNo = (no) => {
  localStorage.setItem(STORAGE_KEYS.INVOICE_NO, no.toString());
};
