const fs = require('fs');
const path = require('path');
const autoGenerateWordReportForDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthStr = monthNames[d.getMonth()] + ' ' + d.getFullYear();
    const fyFolder = d.getMonth() + 1 >= 4 ? d.getFullYear().toString().slice(-2) + '-' + (d.getFullYear() + 1).toString().slice(-2) : (d.getFullYear() - 1).toString().slice(-2) + '-' + d.getFullYear().toString().slice(-2);
    const monthFolder = (d.getMonth() + 1) + '-' + monthNames[d.getMonth()] + '-' + d.getFullYear().toString().slice(-2);
    const dir = path.join(__dirname, 'invoices', fyFolder, monthFolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'Report_' + monthStr.replace(' ', '_') + '.doc');
    console.log('Saving to:', filePath);
    const invoiceDbPath = path.join(__dirname, 'invoicedb.json');
    let data = { invoices: [] };
    if (fs.existsSync(invoiceDbPath)) {
      data = JSON.parse(fs.readFileSync(invoiceDbPath, 'utf8') || '{"invoices":[]}');
    }
    console.log('Parsed DB, invoices count:', data.invoices.length);
    
    const filteredInvoices = data.invoices.filter(inv => {
            if (!inv.invoiceDetails || !inv.invoiceDetails.date) return false;
            const idate = new Date(inv.invoiceDetails.date);
            return idate.getMonth() === d.getMonth() && idate.getFullYear() === d.getFullYear();
    });
    console.log('Filtered invoices count:', filteredInvoices.length);
  } catch (e) {
    console.error('Error:', e);
  }
};
autoGenerateWordReportForDate(new Date().toISOString());
