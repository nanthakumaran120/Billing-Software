import React, { useState } from 'react';
import { Search, XCircle, ArrowLeft } from 'lucide-react';
import { fetchInvoices, cancelInvoice } from '../services/api';

const CancelBill = ({ onBack }) => {
    const [searchNo, setSearchNo] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [foundInvoice, setFoundInvoice] = useState(null);
    const [error, setError] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    const handleSearch = async () => {
        setError('');
        setFoundInvoice(null);
        
        if (!searchNo || !searchDate) {
            setError('Please enter both Order Number and Order Date.');
            return;
        }

        try {
            const invoices = await fetchInvoices();
            const invoice = invoices.find(inv => 
                String(inv.invoiceDetails?.invoiceNo) === String(searchNo) && 
                inv.invoiceDetails?.date === searchDate
            );

            if (invoice) {
                setFoundInvoice(invoice);
            } else {
                setError('No order found matching these details.');
            }
        } catch (err) {
            setError('Failed to fetch orders. Check server connection.');
        }
    };

    const handleCancelBill = async () => {
        if (!foundInvoice) return;
        
        if (foundInvoice.status === 'cancelled') {
            alert('This order is already cancelled!');
            return;
        }

        if (window.confirm(`Are you absolutely sure you want to CANCEL Order No ${foundInvoice.invoiceDetails?.invoiceNo}? This cannot be easily undone.`)) {
            setIsCancelling(true);
            try {
                await cancelInvoice(foundInvoice.id);
                alert(`Order No ${foundInvoice.invoiceDetails?.invoiceNo} has been successfully cancelled.`);
                // Notify other tabs
                try {
                    const channel = new BroadcastChannel('invoice_updates');
                    channel.postMessage('new_invoice');
                    channel.close();
                } catch (err) {
                    console.warn('BroadcastChannel not supported', err);
                }
                
                // Update local state to reflect cancellation immediately
                setFoundInvoice(prev => ({ ...prev, status: 'cancelled' }));
            } catch (err) {
                alert('Failed to cancel order. Please try again.');
            } finally {
                setIsCancelling(false);
            }
        }
    };

    // Calculate total amount for display
    const calculateTotal = (items) => {
        return items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
    };

    return (
        <div className="app-container">
            <div className="w-full max-w-4xl mx-auto">
                <div className="action-bar no-print flex justify-between items-center mb-6">
                    <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                        <ArrowLeft size={18} /> Back to Order
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Cancel a Generated Order</h2>
                    <div style={{ width: '130px' }}></div> {/* spacer for centering */}
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Search Order Details</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Order Number</label>
                            <input 
                                type="number" 
                                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Order No"
                                value={searchNo}
                                onChange={(e) => setSearchNo(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Order Date</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500"
                                value={searchDate}
                                onChange={(e) => setSearchDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <button 
                                onClick={handleSearch}
                                className="btn-primary flex items-center gap-2 py-2 px-6"
                            >
                                <Search size={18} /> Find Order
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-red-500 mt-3 font-bold">{error}</p>}
                </div>

                {foundInvoice && (
                    <div className={`bg-white rounded-lg shadow-lg p-6 border ${foundInvoice.status === 'cancelled' ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start border-b pb-4 mb-4">
                            <div>
                                <h3 className="text-2xl font-extrabold text-gray-800">Order No: {foundInvoice.invoiceDetails?.invoiceNo}</h3>
                                <p className="text-gray-600 font-medium">Date: {foundInvoice.invoiceDetails?.date}</p>
                            </div>
                            {foundInvoice.status === 'cancelled' && (
                                <div className="bg-red-600 text-white px-4 py-1 rounded-full font-bold uppercase tracking-wider text-sm shadow-sm">
                                    CANCELLED
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-1">Customer Details</h4>
                                <p className="font-bold text-lg text-gray-800">{foundInvoice.customer?.name}</p>
                                <p className="text-gray-600">{foundInvoice.customer?.address}</p>
                                <p className="text-gray-600 font-medium mt-1">GSTIN: {foundInvoice.customer?.gstin}</p>
                            </div>
                            <div className="text-right">
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-1">Order Summary</h4>
                                <p className="text-gray-600">Total Items: <span className="font-bold text-gray-800">{foundInvoice.items?.length || 0}</span></p>
                                <p className="text-gray-600 mt-2">Gross Amount:</p>
                                <p className="text-3xl font-extrabold text-blue-700">₹ {calculateTotal(foundInvoice.items).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200">
                            {foundInvoice.status !== 'cancelled' ? (
                                <button 
                                    onClick={handleCancelBill}
                                    disabled={isCancelling}
                                    className="btn-danger-solid py-3 px-8 text-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                                >
                                    <XCircle size={24} /> 
                                    {isCancelling ? 'Cancelling...' : 'Void / Cancel This Order'}
                                </button>
                            ) : (
                                <p className="text-red-600 font-bold italic">This order has already been cancelled.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(CancelBill);
