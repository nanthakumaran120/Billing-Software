import React, { useState, useEffect } from 'react';
import { Printer, Edit, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import Header from './components/Header';
import CustomerSection from './components/CustomerSection';
import ProductTable from './components/ProductTable';
import SummarySection from './components/SummarySection';
import ReportList from './components/ReportList';
import { fetchSettings, saveSettings, saveInvoice, uploadPDFToServer } from './services/api';

const getFinancialYear = (dateStr) => {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1; // 1 to 12
  const year = d.getFullYear();
  if (month >= 4) {
    return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }
};

function App() {
  const [currentView, setCurrentView] = useState('invoice'); // 'invoice' or 'reports'
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [customer, setCustomer] = useState({
    name: '',
    address: '',
    gstin: '',
    state: '',
    stateCode: ''
  });

  const [items, setItems] = useState([
    { description: '', hsn: '6304', qty: '', rate: '', per: 'Nos', amount: '' }
  ]);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadInvoiceNo = async () => {
    try {
      const settings = await fetchSettings();
      const currentDate = new Date().toISOString().split('T')[0];
      const currentFY = getFinancialYear(currentDate);

      let no = settings.nextInvoiceNo || 1;
      
      if (!settings.financialYear) {
        // Just initialize FY without resetting number
        await saveSettings({ financialYear: currentFY, nextInvoiceNo: no });
      } else if (settings.financialYear !== currentFY) {
        no = 1;
        await saveSettings({ nextInvoiceNo: 1, financialYear: currentFY });
      }

      setInvoiceDetails(prev => ({ ...prev, invoiceNo: no }));
    } catch (e) {
      console.error("Failed to load invoice no", e);
    }
  };

  useEffect(() => {
    // Load next invoice number on mount
    loadInvoiceNo();
  }, []);

  const resetForm = () => {
      setCustomer({ name: '', address: '', gstin: '', state: '', stateCode: '' });
      setItems([{ description: '', hsn: '6304', qty: '', rate: '', per: 'Nos', amount: '' }]);
      setIsPreviewMode(false);
      loadInvoiceNo();
  };

  const validateInvoice = () => {
    if (!customer.name || customer.name.trim() === '') {
      alert("Please enter a Customer Name.");
      return false;
    }

    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      alert("Please enter at least one Product Description.");
      return false;
    }

    for (let i = 0; i < validItems.length; i++) {
      if (!validItems[i].qty || parseFloat(validItems[i].qty) <= 0) {
        alert("Please enter a valid Quantity for all products.");
        return false;
      }
      if (!validItems[i].rate || parseFloat(validItems[i].rate) <= 0) {
        alert("Please enter a valid Rate for all products.");
        return false;
      }
    }

    return true;
  };

  const handlePreviewToggle = () => {
      if (!isPreviewMode) {
          if (validateInvoice()) {
              setIsPreviewMode(true);
          }
      } else {
          setIsPreviewMode(false);
      }
  };

  const handlePrintAndSave = async () => {
    setIsSaving(true);
    // 1. Prepare invoice data payload
    const invoiceData = {
      id: Date.now().toString(),
      invoiceDetails,
      customer,
      items: items.filter(item => item.description), // don't save empty rows
      createdAt: new Date().toISOString()
    };

    try {
      // 2. Save entire invoice to db for auditing
      await saveInvoice(invoiceData);

      // 3. Generate PDF and upload to Backend Server
      const container = document.getElementById('pdf-container');
      const papers = container.querySelectorAll('.invoice-paper');

      const origStyles = [];
      papers.forEach(el => {
        origStyles.push({ minHeight: el.style.minHeight, height: el.style.height, margin: el.style.margin });
        // Temporarily constrain height so html2pdf doesn't generate a blank 2nd page per copy
        el.style.minHeight = 'auto';
        el.style.height = '295mm'; // Slightly less than A4 to ensure no overflow
        el.style.margin = '0'; // Prevent on-screen margin from generating blank PDF pages
      });

      const opt = {
          margin:       0,
          filename:     `Bill No ${invoiceDetails.invoiceNo}.pdf`,
          image:        { type: 'jpeg', quality: 1.0 },
          html2canvas:  { scale: 4, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['css', 'avoid-all'] }
      };

      const pdfBlob = await html2pdf().set(opt).from(container).output('blob');

      // Restore original styles
      papers.forEach((el, index) => {
        el.style.minHeight = origStyles[index].minHeight;
        el.style.height = origStyles[index].height;
        el.style.margin = origStyles[index].margin;
      });
      
      // Wait for it to save to the designated folder
      await uploadPDFToServer(pdfBlob, invoiceDetails.invoiceNo, customer.name, invoiceDetails.date);

      // 4. Increment invoice number in settings
      const currentNo = parseInt(invoiceDetails.invoiceNo) || 0;
      if (currentNo > 0) {
        const nextNo = currentNo + 1;
        await saveSettings({ nextInvoiceNo: nextNo });
      }
      
      // 5. Trigger print prompt (as requested)
      window.print();

      // 7. Reset form for new bill
      resetForm();

    } catch (e) {
      console.error("Failed to save invoice or PDF", e);
      alert("Warning: Could not save invoice/PDF correctly. Check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  if (currentView === 'reports') {
    return <ReportList onBack={() => setCurrentView('invoice')} />;
  }

  return (
    <div className={`app-container print-container ${isPreviewMode ? 'preview-active' : ''}`}>

      {/* Action Bar */}
      <div className="action-bar no-print">
        {!isPreviewMode ? (
          <>
            <button
              onClick={handlePreviewToggle}
              className="btn-primary"
            >
              Preview & Finalize Invoice
            </button>
            <button
              onClick={() => setCurrentView('reports')}
              className="btn-secondary flex items-center gap-2"
            >
              <FileText size={18} /> View Reports
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handlePreviewToggle}
              className="btn-secondary"
            >
              <Edit size={18} /> Edit Details
            </button>
            <button
              onClick={handlePrintAndSave}
              className="btn-primary"
              disabled={isSaving}
            >
              <Printer size={18} /> {isSaving ? 'Saving & Generating...' : 'Save & Print Invoice'}
            </button>
          </>
        )}
      </div>

      {/* Invoice Papers */}
      {/* We use pointer-events-none in preview mode to prevent accidental edits */}
      <div id="pdf-container" className="w-full flex flex-col items-center">
        {(isPreviewMode ? ['Original', 'Duplicate', 'Triplicate'] : ['Original']).map((copyType, index) => (
          <React.Fragment key={copyType}>
            <div
              className={`invoice-paper print-paper ${isPreviewMode ? 'pointer-events-none' : ''}`}
            >
              {isPreviewMode && (
                <div className="relative w-full h-0 z-10">
                  <div className="absolute text-[9px] uppercase text-gray-800 tracking-wider font-normal" style={{ top: '-7mm', right: '0' }}>
                    [ {copyType} ]
                  </div>
                </div>
              )}
              <div className="master-invoice-box">
                <Header />
                <CustomerSection
                  customer={customer}
                  setCustomer={setCustomer}
                  invoiceDetails={invoiceDetails}
                  setInvoiceDetails={setInvoiceDetails}
                  isPreviewMode={isPreviewMode}
                />
                <div className="table-section">
                  <ProductTable
                    items={items}
                    setItems={setItems}
                    isPreviewMode={isPreviewMode}
                  />
                </div>
                <div className="summary-section">
                  <SummarySection
                    items={items}
                    customerStateCode={customer.stateCode}
                  />
                </div>
              </div>
            </div>
            {/* Page Break for html2pdf and print */}
            {isPreviewMode && index < 2 && (
              <div className="html2pdf__page-break" style={{ pageBreakAfter: 'always', width: '100%' }}></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default App;
