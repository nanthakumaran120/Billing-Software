import React, { useState, useEffect } from 'react';
import { fetchInvoices, saveWordReport } from '../services/api';
import { ArrowLeft, Printer, Save } from 'lucide-react';

const ReportList = ({ onBack }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('All');

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchInvoices();
            // Sort by invoice number ascending (Bill 7, 8, 9, 10...)
            const sortedData = data.sort((a, b) => {
                const numA = parseInt(a.invoiceDetails?.invoiceNo) || 0;
                const numB = parseInt(b.invoiceDetails?.invoiceNo) || 0;
                return numA - numB;
            });
            setInvoices(sortedData);
            setLoading(false);
        };
        loadData();
    }, []);

    const formatCurrency = (amount) => {
        return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const processInvoice = (inv) => {
        const items = inv.items || [];
        const customer = inv.customer || {};
        const stateCode = customer.stateCode || '';
        
        const subtotal = items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
        const isIntraState = stateCode === '33'; // Tamil Nadu
        
        const cgst = isIntraState ? subtotal * 0.025 : 0;
        const sgst = isIntraState ? subtotal * 0.025 : 0;
        const igst = !isIntraState ? subtotal * 0.05 : 0;
        
        const totalAmount = Math.round(subtotal + cgst + sgst + igst);
        
        return {
            subtotal,
            cgst,
            sgst,
            igst,
            totalAmount
        };
    };

    const getMonthYear = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const d = new Date(dateStr);
        return d.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const availableMonths = ['All', ...new Set(invoices.map(inv => getMonthYear(inv.invoiceDetails?.date)))].filter(Boolean);

    const filteredInvoices = selectedMonth === 'All' 
        ? invoices 
        : invoices.filter(inv => getMonthYear(inv.invoiceDetails?.date) === selectedMonth);

    const handleSaveWord = async () => {
        const content = document.getElementById('report-content');
        if (!content) return;
        
        try {
            const htmlString = content.innerHTML;
            const monthStr = selectedMonth === 'All' ? 'All_Months' : selectedMonth;
            const res = await saveWordReport(htmlString, monthStr);
            alert(`Report saved to folder successfully!\nLocation: ${res.path}`);
        } catch (error) {
            alert("Failed to save report. Please check the backend connection.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading reports...</div>;
    }

    return (
        <div className="report-container w-full h-full bg-gray-100 p-4 print:p-0 print:bg-white flex flex-col">
            <style>
                {`
                @media print {
                    @page { size: landscape; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-container { padding: 0 !important; background: transparent !important; box-shadow: none !important; }
                    .table-header th { background-color: #f3f4f6 !important; border-bottom: 2px solid #1f2937 !important; }
                    .report-table { border: 2px solid #1f2937 !important; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr { page-break-inside: avoid; }
                }
                `}
            </style>
            
            <div className="action-bar no-print flex justify-between items-center mb-4 bg-white p-4 rounded shadow">
                <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft size={18} /> Back to Bill Generation
                </button>
                <h2 className="text-xl font-bold text-gray-800">Generated Bills Report</h2>
                <div className="flex gap-2">
                    <button onClick={handleSaveWord} className="btn-secondary flex items-center gap-2 text-blue-700 border-blue-700 hover:bg-blue-50">
                        <Save size={18} /> Save to Folder (Word)
                    </button>
                    <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
                        <Printer size={18} /> Print Landscape Report
                    </button>
                </div>
            </div>

            <div id="report-content" className="flex-1 bg-white p-4 rounded shadow print:shadow-none print:p-0 overflow-auto">
                {/* Professional Report Header */}
                <div className="mb-6 flex flex-col items-center border-b-2 border-gray-800 pb-4 mt-4">
                    <h1 className="text-3xl font-extrabold text-blue-900 tracking-wider">SRINIVASA DYEING</h1>
                    <p className="font-bold text-gray-700 uppercase tracking-widest text-sm">Dyeing & Cloth Merchant</p>
                    <p className="text-gray-600 text-xs mt-1">22, Kattur Road, C.S. Puram P.O., 637 401, Rasipuram Tk, Namakkal Dt, Tamil Nadu</p>
                    <p className="font-bold text-gray-800 text-sm mt-1">GSTIN: 33AKQPA9652A1ZD</p>
                    
                    <div className="mt-6 pt-4 border-t border-gray-300 w-full flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold uppercase text-gray-900">MONTHLY SALES / GST REPORT (GSTR-2B Format)</h2>
                            <p className="text-sm font-semibold text-gray-600 mt-1">
                                {selectedMonth === 'All' ? 'Complete Statement - All Invoices' : `Statement for the month of: ${selectedMonth}`}
                            </p>
                        </div>
                        <div className="text-right text-xs font-semibold text-gray-600">
                            <p>Date of Generation: {formatDate(new Date().toISOString())}</p>
                        </div>
                    </div>
                </div>

                {/* Folder Tabs for Months */}
                <div className="flex overflow-x-auto mb-4 no-print gap-1 border-b border-gray-300 px-2">
                    {availableMonths.map(month => (
                        <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            className={`px-4 py-2 text-sm font-bold rounded-t-lg border border-b-0 transition-colors ${
                                selectedMonth === month
                                    ? 'bg-white text-blue-700 border-gray-300 border-b-white relative z-10'
                                    : 'bg-gray-200 text-gray-600 border-transparent hover:bg-gray-300'
                            }`}
                            style={{ marginBottom: selectedMonth === month ? '-1px' : '0' }}
                        >
                            {month === 'All' ? 'All Months' : month}
                        </button>
                    ))}
                </div>

                <table className="report-table w-full text-xs text-left border-collapse border border-gray-400">
                    <thead className="table-header bg-gray-100">
                        <tr>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-center w-12">S.No</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800">GSTIN of supplier/buyer</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800">Trade/Legal name</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-center">Invoice No</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-center">Invoice Date</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-right">Taxable Value (₹)</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-right">Central Tax (₹)</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-right">State/UT Tax (₹)</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-right">IGST (₹)</th>
                            <th className="border border-gray-400 p-2 font-bold text-gray-800 text-right">Invoice Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="border border-gray-400 p-4 text-center text-gray-500">No invoices found.</td>
                            </tr>
                        ) : (
                            filteredInvoices.map((inv, index) => {
                                const details = processInvoice(inv);
                                const invDetails = inv.invoiceDetails || {};
                                const customer = inv.customer || {};

                                return (
                                    <tr key={inv.id || index} className="hover:bg-gray-50">
                                        <td className="border border-gray-400 p-2 text-center text-gray-700">{index + 1}</td>
                                        <td className="border border-gray-400 p-2 text-gray-800 font-medium uppercase">{customer.gstin || '-'}</td>
                                        <td className="border border-gray-400 p-2 text-gray-800 font-bold uppercase">{customer.name || '-'}</td>
                                        <td className="border border-gray-400 p-2 text-center text-gray-800">{invDetails.invoiceNo || '-'}</td>
                                        <td className="border border-gray-400 p-2 text-center text-gray-800">{formatDate(invDetails.date)}</td>
                                        <td className="border border-gray-400 p-2 text-right text-gray-800">{formatCurrency(details.subtotal)}</td>
                                        <td className="border border-gray-400 p-2 text-right text-gray-800">{formatCurrency(details.cgst)}</td>
                                        <td className="border border-gray-400 p-2 text-right text-gray-800">{formatCurrency(details.sgst)}</td>
                                        <td className="border border-gray-400 p-2 text-right text-gray-800">{formatCurrency(details.igst)}</td>
                                        <td className="border border-gray-400 p-2 text-right text-gray-900 font-bold">{formatCurrency(details.totalAmount)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    {filteredInvoices.length > 0 && (
                        <tfoot className="bg-gray-50 font-bold">
                            <tr>
                                <td colSpan="5" className="border border-gray-400 p-2 text-right text-gray-900 uppercase">Total</td>
                                <td className="border border-gray-400 p-2 text-right text-gray-900">
                                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + processInvoice(inv).subtotal, 0))}
                                </td>
                                <td className="border border-gray-400 p-2 text-right text-gray-900">
                                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + processInvoice(inv).cgst, 0))}
                                </td>
                                <td className="border border-gray-400 p-2 text-right text-gray-900">
                                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + processInvoice(inv).sgst, 0))}
                                </td>
                                <td className="border border-gray-400 p-2 text-right text-gray-900">
                                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + processInvoice(inv).igst, 0))}
                                </td>
                                <td className="border border-gray-400 p-2 text-right text-gray-900">
                                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + processInvoice(inv).totalAmount, 0))}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>

                {/* Auditor Signature Block */}
                <div className="mt-8 pt-12 flex justify-between items-end text-sm text-gray-800 w-full px-8" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex flex-col items-center">
                        <div className="border-t border-gray-800 w-48 mb-2"></div>
                        <p className="font-bold">Prepared By</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="border-t border-gray-800 w-48 mb-2"></div>
                        <p className="font-bold">Audited By / Auditor</p>
                    </div>
                    <div className="flex flex-col items-center text-right">
                        <p className="font-bold italic text-xs mb-8 text-gray-600">For SRINIVASA DYEING</p>
                        <div className="border-t border-gray-800 w-48 mb-2"></div>
                        <p className="font-bold">Authorised Signatory</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportList;
