import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Printer, Edit, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import Header from './components/Header';
import CustomerSection from './components/CustomerSection';
import Login from './components/Login';
import { fetchSettings, saveSettings, saveInvoice, uploadPDFToServer } from './services/api';

const ProductTable = lazy(() => import('./components/ProductTable'));
const SummarySection = lazy(() => import('./components/SummarySection'));
const ReportList = lazy(() => import('./components/ReportList'));
const CancelBill = lazy(() => import('./components/CancelBill'));
const PrintPreview = lazy(() => import('./components/PrintPreview'));

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
  const [isAuthenticated, setIsAuthenticated] = useState(true);
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
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [savedInvoiceForPreview, setSavedInvoiceForPreview] = useState(null);

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

  const handlePrintAndSave = async (saveOnly = false) => {
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
      try {
        await saveInvoice(invoiceData);
      } catch (error) {
        console.log(error);
      }

      // 3. Generate PDF and upload to Backend Server (Temporarily disabled/commented out for Vercel deployment)
      /*
      try {
        const container = document.getElementById('pdf-container');
        const papers = container.querySelectorAll('.invoice-paper');

        const origStyles = [];
        papers.forEach(el => {
          origStyles.push({ minHeight: el.style.minHeight, height: el.style.height, margin: el.style.margin });
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

        // Generate PDF of only the first paper (Original copy)
        const pdfBlob = await html2pdf().set(opt).from(papers[0]).output('blob');

        // Restore original styles
        papers.forEach((el, index) => {
          el.style.minHeight = origStyles[index].minHeight;
          el.style.height = origStyles[index].height;
          el.style.margin = origStyles[index].margin;
        });
        
        // Wait for it to save to the designated folder
        await uploadPDFToServer(pdfBlob, invoiceDetails.invoiceNo, customer.name, invoiceDetails.date);
      } catch (pdfError) {
        console.log("PDF generation/upload failed:", pdfError);
      }
      */

      // 3. Increment next invoice number is handled server-side by POST /invoices.
      //    No need to call saveSettings here — avoids double-incrementing the invoice number.
      
      // Notify other tabs (like the Report List) to update instantly
      try {
        const channel = new BroadcastChannel('invoice_updates');
        channel.postMessage({ type: 'NEW_INVOICE' });
        channel.close();
      } catch (err) {
        console.warn('BroadcastChannel not supported', err);
      }

      // 5. Trigger print prompt (as requested)
      if (!saveOnly) {
        window.print();
      }

      // 7. Reset form for new bill
      resetForm();
      setShowPrintPreview(false);
      alert("Invoice saved successfully");

    } catch (e) {
      console.error("Failed to save invoice or PDF", e);
      alert("Warning: Could not save invoice correctly. Check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndPrintOrder = async () => {
    if (!validateInvoice()) return;
    
    setIsSaving(true);
    
    // Create the invoice data snapshot
    const invoiceData = {
      id: Date.now().toString(),
      invoiceDetails: { ...invoiceDetails },
      customer: { ...customer },
      items: items.filter(item => item.description),
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save invoice to SQLite db immediately
      await saveInvoice(invoiceData);

      // 2. Broadcast change instantly to other screens
      try {
        const channel = new BroadcastChannel('invoice_updates');
        channel.postMessage({ type: 'NEW_INVOICE' });
        channel.close();
      } catch (err) {
        console.warn('BroadcastChannel not supported', err);
      }

      // 3. Clear/reset form and increment invoice number automatically in the background
      // Save details first so they don't get lost when resetting state
      setSavedInvoiceForPreview(invoiceData);
      
      // Reset form
      setCustomer({ name: '', address: '', gstin: '', state: '', stateCode: '' });
      setItems([{ description: '', hsn: '6304', qty: '', rate: '', per: 'Nos', amount: '' }]);
      setIsPreviewMode(false);
      
      // Increment invoice number and load next in background
      await loadInvoiceNo(); 

      // 4. Open print preview
      setShowPrintPreview(true);

    } catch (e) {
      console.error("Save & Print failed:", e);
      alert("Failed to save invoice correctly. Check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentView === 'reports') {
    return (
      <Suspense fallback={<div className="p-8 text-center text-lg font-semibold text-blue-900">Loading GST Reports...</div>}>
        <ReportList onBack={() => setCurrentView('invoice')} />
      </Suspense>
    );
  }

  if (currentView === 'cancel-bill') {
    return (
      <Suspense fallback={<div className="p-8 text-center text-lg font-semibold text-red-800">Loading Order Cancellation audit...</div>}>
        <CancelBill onBack={() => setCurrentView('invoice')} />
      </Suspense>
    );
  }

  return (
    <div className={`app-container print-container ${isPreviewMode ? 'preview-active' : ''}`}>

      {/* Action Bar */}
      <div className="action-bar no-print">
        <button
          onClick={() => setCurrentView('cancel-bill')}
          className="btn-danger-solid mr-auto"
        >
          Cancel Order
        </button>
        {!isPreviewMode ? (
          <>
            <button
              onClick={handlePreviewToggle}
              className="btn-primary"
            >
              Preview & Finalize Order
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
              onClick={handleSaveAndPrintOrder}
              className="btn-primary"
              disabled={isSaving}
            >
              <Printer size={18} /> {isSaving ? 'Saving & Generating...' : 'Save & Print Order'}
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
                  <Suspense fallback={<div className="p-4 text-center text-sm font-semibold text-gray-500">Loading ledger items...</div>}>
                    <ProductTable
                      items={items}
                      setItems={setItems}
                      isPreviewMode={isPreviewMode}
                    />
                  </Suspense>
                </div>
                <div className="summary-section">
                  <Suspense fallback={<div className="p-4 text-center text-sm font-semibold text-gray-500">Loading totals summary...</div>}>
                    <SummarySection
                      items={items}
                      customerStateCode={customer.stateCode}
                    />
                  </Suspense>
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
      {showPrintPreview && savedInvoiceForPreview && (
        <Suspense fallback={<div className="fixed top-0 left-0 w-screen h-screen bg-[#202124] text-white flex items-center justify-center font-bold text-lg">Generating print preview layout...</div>}>
          <PrintPreview
            customer={savedInvoiceForPreview.customer}
            items={savedInvoiceForPreview.items}
            invoiceDetails={savedInvoiceForPreview.invoiceDetails}
            onCancel={() => {
              setShowPrintPreview(false);
              setSavedInvoiceForPreview(null);
            }}
            onSaveAndReset={() => {
              setShowPrintPreview(false);
              setSavedInvoiceForPreview(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
