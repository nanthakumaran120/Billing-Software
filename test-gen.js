const fs = require('fs');
const path = require('path');
const baseInvoicePath = path.join(__dirname, 'invoices');
const INVOICE_DB = path.join(__dirname, 'invoicedb.json');

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
  return `${month}-${monthName}-${year2}`;
};

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

        filteredInvoices.sort((a, b) => new Date(a.invoiceDetails.date) - new Date(b.invoiceDetails.date));

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

                rowsHtml += `<tr><td>Test</td></tr>`;
            });
        }

        const htmlString = `<html><body>test</body></html>`;

        fs.writeFileSync(filePath, htmlString, 'utf8');
        console.log(`Auto-generated Word report: ${filePath}`);
    } catch (e) {
        console.error("Failed to auto generate word report:", e);
    }
};

autoGenerateWordReportForDate(new Date().toISOString());
