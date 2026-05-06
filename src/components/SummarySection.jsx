import React from 'react';
import writtenNumber from 'written-number';

// Helper for Indian numbering system words (optional library fallback if needed, but basic implementation here)
// written-number might not default to Indian system perfectly, but it's close enough for general words.
// For perfect Indian Rupee words, a custom function is better.
const toWords = (num) => {
    try {
        const words = writtenNumber(Math.floor(num));
        return words.charAt(0).toUpperCase() + words.slice(1) + " Rupees Only";
    } catch {
        return "";
    }
}

const SummarySection = ({ items, customerStateCode }) => {
    const calculateSubtotal = () => {
        return items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
    };

    const subtotal = calculateSubtotal();
    const isIntraState = customerStateCode === '33'; // Tamil Nadu

    // Tax Rates
    const cgstRate = 0.025;
    const sgstRate = 0.025;
    const igstRate = 0.05;

    const cgst = isIntraState ? subtotal * cgstRate : 0;
    const sgst = isIntraState ? subtotal * sgstRate : 0;
    const igst = !isIntraState ? subtotal * igstRate : 0;

    const totalTax = cgst + sgst + igst;
    const totalAmount = Math.round(subtotal + totalTax); // Usually invoices are rounded to nearest rupee

    const formatCurrency = (amount) => {
        return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="flex flex-col text-sm border-t border-gray-400">
            
            <div className="flex">
                {/* Left Side: Amount in words & Bank Details */}
                <div className="flex-1 border-r border-gray-400 p-2 flex flex-col justify-between bg-gray-50 print:bg-transparent">
                    <div>
                        <p className="font-bold underline mb-1 text-gray-700 text-[10px] uppercase">Invoice Amount in Words :</p>
                        <p className="font-bold italic text-blue-800 text-xs">{toWords(totalAmount)}</p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-gray-400">
                        <table className="text-xs font-semibold text-gray-700 leading-tight">
                            <tbody>
                                <tr>
                                    <td className="pr-2 pb-1">Account No.</td>
                                    <td className="pb-1 text-black font-bold">: 461252283</td>
                                </tr>
                                <tr>
                                    <td className="pr-2 pb-1">Bank Name</td>
                                    <td className="pb-1 text-black font-bold">: Indian Bank</td>
                                </tr>
                                <tr>
                                    <td className="pr-2 pb-1">Branch</td>
                                    <td className="pb-1 text-black font-bold">: Rasipuram</td>
                                </tr>
                                <tr>
                                    <td className="pr-2">IFSC Code</td>
                                    <td className="text-black font-bold">: IDIB000R014</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                     <p className="text-xs font-bold mt-2 text-gray-700">Declaration :</p>
                     <p className="text-xs italic leading-tight text-gray-600">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                </div>

                {/* Right Side: Totals Grid */}
                <div className="w-1/3 min-w-[300px]">
                    <table className="w-full h-full font-bold text-gray-800">
                        <tbody>
                            <tr>
                                <td className="border-b border-gray-400 p-1 px-2 w-3/5 text-gray-600">Total Amount Before Tax</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-center w-4">:</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(subtotal)}</td>
                            </tr>

                            {isIntraState ? (
                                <>
                                    <tr>
                                        <td className="border-b border-gray-400 p-1 px-2 text-gray-600">Add CGST 2.5 %</td>
                                        <td className="border-b border-gray-400 p-1 px-2 text-center">:</td>
                                        <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(cgst)}</td>
                                    </tr>
                                    <tr>
                                        <td className="border-b border-gray-400 p-1 px-2 text-gray-600">Add SGST 2.5 %</td>
                                        <td className="border-b border-gray-400 p-1 px-2 text-center">:</td>
                                        <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(sgst)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td className="border-b border-gray-400 p-1 px-2 text-gray-600">Add: IGST 5%</td>
                                    <td className="border-b border-gray-400 p-1 px-2 text-center">:</td>
                                    <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(igst)}</td>
                                </tr>
                            )}

                            <tr>
                                <td className="border-b border-gray-400 p-1 px-2 text-gray-600">Total Tax Amount</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-center">:</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(totalTax)}</td>
                            </tr>
                            
                            <tr>
                                <td className="border-b border-gray-400 p-1 px-2 text-gray-600">Total Amount after Tax</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-center">:</td>
                                <td className="border-b border-gray-400 p-1 px-2 text-right">{formatCurrency(subtotal + totalTax)}</td>
                            </tr>
                             <tr className="text-gray-900 print:text-black">
                                <td className="p-1 px-2 text-base uppercase tracking-wider font-extrabold">Total</td>
                                <td className="p-1 px-2 text-center text-base font-extrabold">:</td>
                                <td className="p-1 px-2 text-right text-base font-extrabold text-blue-900">{formatCurrency(totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Final Row: Signatures */}
            <div className="flex justify-between border-t border-gray-400 p-2 min-h-[100px] bg-gray-50 print:bg-white text-gray-800" style={{ pageBreakBefore: 'avoid', pageBreakAfter: 'avoid' }}>
                 <div className="flex flex-col justify-end">
                      <p className="font-bold text-sm text-gray-700">Customer's Seal and Signature</p>
                 </div>
                 <div className="flex flex-col justify-end items-end text-sm text-right">
                       <p className="font-bold italic text-xs mb-8 text-gray-600">For SRINIVASA DYEING</p>
                      <p className="font-bold text-gray-800">Authorised Signatory</p>
                 </div>
            </div>

        </div>
    );
};

export default SummarySection;
