import React, { useState, useEffect } from 'react';
import { fetchCustomers, createCustomer } from '../services/api';

const CustomerSection = ({ customer, setCustomer, invoiceDetails, setInvoiceDetails, isPreviewMode }) => {
    const [savedCustomers, setSavedCustomers] = useState([]);
    const [isNew, setIsNew] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [maxItems, setMaxItems] = useState(4);

    useEffect(() => {
        loadCustomerData();
    }, []);

    const loadCustomerData = async () => {
        try {
            const customers = await fetchCustomers();
            setSavedCustomers(customers || []);
        } catch (e) {
            console.error("Failed to load customers", e);
        }
    };

    const handleCustomerSelect = (e) => {
        const selectedId = e.target.value;
        if (selectedId === 'new') {
            setIsNew(true);
            setCustomer({ name: '', address: '', gstin: '', state: '', stateCode: '' });
        } else {
            setIsNew(false);
            const selected = savedCustomers.find(c => c.id.toString() === selectedId);
            if (selected) {
                setCustomer(selected);
            }
        }
    };

    const handleSelectCustomerFromDropdown = (selCustomer) => {
        setCustomer(selCustomer);
        setIsNew(false);
        setShowDropdown(false);
        setMaxItems(4);
    };

    const rawFilteredCustomers = savedCustomers.filter(c =>
        c.name.toLowerCase().includes((customer.name || '').toLowerCase())
    );

    const uniqueCustomers = [];
    const seenNames = new Set();
    for (const c of rawFilteredCustomers) {
        const lowerName = c.name.toLowerCase();
        if (!seenNames.has(lowerName)) {
            seenNames.add(lowerName);
            uniqueCustomers.push(c);
        }
    }
    
    const displayCustomers = uniqueCustomers.slice(0, maxItems);
    const hasMore = uniqueCustomers.length > maxItems;

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // If they type or select a Name that perfectly matches a saved customer, auto-fill the rest.
        if (name === 'name') {
            setShowDropdown(true);
            setMaxItems(4);
            const matchedCustomer = savedCustomers.find((c) => c.name.toLowerCase() === value.toLowerCase());
            if (matchedCustomer) {
                setCustomer(matchedCustomer);
                setIsNew(false);
                return;
            } else {
                setIsNew(true);
            }
        }
        
        setCustomer(prev => ({ ...prev, [name]: value }));
    };

    const saveNewCustomer = async () => {
        if (customer.name) {
            try {
                await createCustomer({
                    ...customer,
                    id: Date.now().toString()
                });
                await loadCustomerData();
                setIsNew(false);
                alert('Customer Saved to Database!');
            } catch (error) {
                alert('Failed to save customer');
            }
        }
    };

    const handleInvoiceDateChange = (e) => {
        setInvoiceDetails({ ...invoiceDetails, date: e.target.value });
    };

    return (
        <div className="flex flex-col text-sm font-semibold border-b border-gray-400">
            
            {/* Top row: Invoice No, Date, State */}
            <div className="flex flex-row w-full border-b border-blue-900 bg-gray-50 print:bg-transparent">
               <div className="w-1/3 flex items-center border-r border-blue-900 p-3">
                   <label className="mr-2 whitespace-nowrap text-gray-800 text-xs font-bold uppercase">Invoice No. :</label>
                   <input
                        type="text"
                         className="font-bold flex-1 text-xl text-blue-900 p-0 bg-transparent"
                         value={invoiceDetails.invoiceNo}
                         onChange={(e) => setInvoiceDetails({ ...invoiceDetails, invoiceNo: e.target.value })}
                   />
               </div>
               <div className="w-1/3 flex items-center border-r border-blue-900 p-3">
                   <label className="mr-2 whitespace-nowrap text-gray-800 text-xs font-bold uppercase">Date :</label>
                   {isPreviewMode ? (
                       <span className="font-bold flex-1 text-base text-gray-900">
                           {invoiceDetails.date ? invoiceDetails.date.split('-').reverse().join('-') : ''}
                       </span>
                   ) : (
                       <input
                           type="date"
                           className="font-bold flex-1 text-base p-0 bg-transparent"
                           value={invoiceDetails.date}
                           onChange={handleInvoiceDateChange}
                       />
                   )}
               </div>
               <div className="w-1/3 flex items-center p-3">
                   <label className="mr-2 whitespace-nowrap text-gray-800 text-xs font-bold uppercase">State :</label>
                   <input
                       type="text"
                       className="flex-1 font-bold text-base p-0 bg-transparent"
                       value={customer.state || "Tamil Nadu"} 
                       readOnly
                   />
               </div>
            </div>

            {/* Bottom Row: Billed Party Details */}
            <div className="flex flex-col relative group z-50">
                <div className="w-full flex border-b border-gray-400 bg-gray-50 print:bg-transparent">
                     <div className="w-1/2 flex flex-col border-r border-gray-400 p-3">
                         <label className="text-gray-600 text-[11px] mb-2 italic">Details of Receiver / Billed Party</label>
                         <div className="flex items-center gap-1 relative">
                             <label className="text-gray-700 text-xs font-bold uppercase">Name :</label>
                             <div className="relative flex-1">
                                 {isPreviewMode ? (
                                     <div className="font-bold w-full uppercase p-0 text-base text-blue-800 whitespace-pre-wrap break-words">
                                         {customer.name}
                                     </div>
                                 ) : (
                                     <>
                                         <input
                                             type="text"
                                             name="name"
                                             className="font-bold w-full uppercase p-0 text-base border-none bg-transparent outline-none text-blue-800 no-print"
                                             placeholder="Customer Name"
                                             value={customer.name}
                                             onChange={handleChange}
                                             onFocus={() => { setShowDropdown(true); setMaxItems(4); }}
                                             onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                             autoComplete="off"
                                         />
                                         <div className="print-only font-bold w-full uppercase p-0 text-base text-blue-800 whitespace-pre-wrap break-words">
                                             {customer.name}
                                         </div>
                                     </>
                                 )}
                                 {showDropdown && (
                                     <ul className="autocomplete-dropdown">
                                         {uniqueCustomers.length > 0 ? (
                                             <>
                                                 {displayCustomers.map(c => (
                                                     <li 
                                                         key={c.id} 
                                                         className="autocomplete-item"
                                                         onMouseDown={(e) => {
                                                             e.preventDefault();
                                                             handleSelectCustomerFromDropdown(c);
                                                         }}
                                                     >
                                                         <span className="title">{c.name}</span>
                                                         <span className="subtitle">{c.address} - GST: {c.gstin}</span>
                                                     </li>
                                                 ))}
                                                 {hasMore && (
                                                     <li 
                                                         className="autocomplete-show-more"
                                                         onMouseDown={(e) => {
                                                             e.preventDefault();
                                                             setMaxItems(prev => prev + 10);
                                                         }}
                                                     >
                                                         Show more ({uniqueCustomers.length - maxItems} additional)
                                                     </li>
                                                 )}
                                             </>
                                         ) : (
                                              <li className="autocomplete-item no-match">No matches found...</li>
                                         )}
                                     </ul>
                                 )}
                             </div>
                         </div>
                     </div>
                     <div className="w-1/2 flex flex-col p-2">
                         <div className="flex flex-col h-full justify-center">
                             <label className="text-gray-600 text-[10px] uppercase font-bold mb-1">Address :</label>
                             {isPreviewMode ? (
                                 <div className="flex-1 w-full p-0 leading-tight text-sm font-medium whitespace-pre-wrap break-words min-h-[3em]">
                                     {customer.address}
                                 </div>
                             ) : (
                                 <>
                                     <textarea
                                         name="address"
                                         className="flex-1 w-full p-0 leading-tight resize-none border-none bg-transparent text-sm font-medium no-print"
                                         rows="3"
                                         placeholder="Address"
                                         value={customer.address}
                                         onChange={handleChange}
                                     />
                                     <div className="print-only flex-1 w-full p-0 leading-tight text-sm font-medium whitespace-pre-wrap break-words min-h-[3em]">
                                         {customer.address}
                                     </div>
                                 </>
                             )}
                         </div>
                     </div>
                </div>

                <div className="w-full flex">
                     <div className="w-1/3 flex flex-col border-r border-gray-400 p-2">
                          <label className="text-gray-600 text-[10px] uppercase font-bold mb-1">GSTIN :</label>
                          <input
                               type="text"
                               name="gstin"
                               className="font-bold w-full border-none uppercase bg-transparent p-0 text-sm"
                               placeholder="GSTIN"
                               value={customer.gstin}
                               onChange={(e) => { e.target.value = e.target.value.toUpperCase(); handleChange(e); }}
                          />
                     </div>
                     <div className="w-1/3 flex flex-col border-r border-gray-400 p-2">
                          <label className="text-gray-600 text-[10px] uppercase font-bold mb-1">State :</label>
                          <input
                               type="text"
                               name="state"
                               className="font-bold w-full border-none bg-transparent p-0 text-sm"
                               placeholder="State"
                               value={customer.state}
                               onChange={handleChange}
                          />
                     </div>
                     <div className="w-1/3 flex flex-col p-2">
                          <label className="text-gray-600 text-[10px] uppercase font-bold mb-1">Code :</label>
                          <input
                               type="text"
                               name="stateCode"
                               className="font-bold w-full border-none bg-transparent p-0 text-sm"
                               placeholder="Code"
                               value={customer.stateCode}
                               onChange={handleChange}
                          />
                     </div>
                </div>

                {/* Database Actions */}
                {!isPreviewMode && (
                <div className="absolute top-2 right-2 flex gap-2 no-print">
                    <select
                        className="text-xs bg-white border border-blue-200 text-blue-800 rounded-md px-2 py-1 cursor-pointer shadow-sm hover:border-blue-400 transition-colors"
                        onChange={handleCustomerSelect}
                        value={isNew ? 'new' : (customer.id || '')}
                    >
                        <option value="" disabled>Select saved...</option>
                        {savedCustomers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        <option value="new">+ Clear Form</option>
                    </select>

                    {isNew && (
                        <button
                            onClick={saveNewCustomer}
                            className="text-xs bg-blue-700 text-white px-3 py-1 rounded-md shadow-sm hover:bg-blue-800 transition-colors font-bold"
                        >
                            Save
                        </button>
                    )}
                </div>
                )}
            </div>

        </div>
    );
};

export default CustomerSection;
