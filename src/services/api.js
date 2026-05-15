const BASE_URL = window.location.origin;

const CUSTOMERS_API_URL = BASE_URL;
const PRODUCTS_API_URL = BASE_URL;
const INVOICES_API_URL = BASE_URL;

export const fetchCustomers = async () => {
    const response = await fetch(`${CUSTOMERS_API_URL}/customers`);
    return response.json();
};

export const createCustomer = async (customer) => {
    const response = await fetch(`${CUSTOMERS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
    });
    return response.json();
};

export const fetchProducts = async () => {
    const response = await fetch(`${PRODUCTS_API_URL}/products`);
    return response.json();
};

export const createProduct = async (product) => {
    const response = await fetch(`${PRODUCTS_API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    });
    return response.json();
};

export const fetchSettings = async () => {
    const response = await fetch(`${INVOICES_API_URL}/settings`);
    return await response.json();
};

export const saveSettings = async (settingsUpdates) => {
    try {
        await fetch(`${INVOICES_API_URL}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsUpdates)
        });
    } catch (e) {
        console.error("Failed to save settings", e);
    }
};

export const fetchInvoices = async () => {
    try {
        const response = await fetch(`${INVOICES_API_URL}/invoices`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch invoices", e);
        return [];
    }
};

export const saveInvoice = async (invoiceData) => {
    try {
        const response = await fetch(`${INVOICES_API_URL}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoiceData)
        });
        return response.json();
    } catch (e) {
        console.error("Failed to save full invoice", e);
        throw e;
    }
};

export const uploadPDFToServer = async (pdfBlob, invoiceNo, customerName, date) => {
    try {
        const formData = new FormData();
        formData.append('invoiceNo', invoiceNo);
        formData.append('customerName', customerName);
        formData.append('date', date);
        formData.append('pdf', pdfBlob, `Bill No ${invoiceNo}.pdf`);

        const response = await fetch(`${BASE_URL}/api/save-pdf`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Failed to save PDF: ${response.statusText}`);
        }

        return await response.json();

    } catch (e) {
        console.error("Failed to upload PDF", e);
        throw e;
    }
}

export const saveWordReport = async (htmlContent, monthStr) => {
    try {
        const response = await fetch(`${BASE_URL}/api/save-word-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: htmlContent, monthStr })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save report: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (e) {
        console.error("Failed to save Word report to server", e);
        throw e;
    }
};