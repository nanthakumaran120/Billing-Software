import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fetchProducts, createProduct } from '../services/api';

const ProductTable = ({ items, setItems, isPreviewMode }) => {
    const [savedProducts, setSavedProducts] = useState([]);
    // activeDropdown tracks which row's product dropdown is open
    const [activeDropdown, setActiveDropdown] = useState(null);
    // productSearch tracks per-row search text
    const [productSearch, setProductSearch] = useState({});

    useEffect(() => {
        loadProductData();
    }, []);

    const loadProductData = async () => {
        try {
            const products = await fetchProducts();
            setSavedProducts(products || []);
        } catch (e) {
            console.error("Failed to load products", e);
        }
    };

    /** Filter suggestions for a given row index */
    const getSuggestions = (index) => {
        const query = (productSearch[index] ?? items[index]?.description ?? '').toLowerCase();
        return savedProducts.filter(p =>
            p.description.toLowerCase().includes(query)
        );
    };

    const handleProductSearchChange = (index, value) => {
        setProductSearch(prev => ({ ...prev, [index]: value }));
        setActiveDropdown(index);

        // Also update description in items
        const newItems = [...items];
        newItems[index].description = value;
        // Check exact match & auto-fill
        const exactMatch = savedProducts.find(p => p.description.toLowerCase() === value.toLowerCase());
        if (exactMatch) {
            newItems[index] = {
                ...newItems[index],
                ...exactMatch,
                amount: (exactMatch.rate * (parseFloat(newItems[index].qty) || 0)).toFixed(2)
            };
            setProductSearch(prev => ({ ...prev, [index]: exactMatch.description }));
        }
        setItems(newItems);
    };

    const handleSelectProduct = (index, product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            ...product,
            amount: (product.rate * (parseFloat(newItems[index].qty) || 0)).toFixed(2)
        };
        setItems(newItems);
        setProductSearch(prev => ({ ...prev, [index]: product.description }));
        setActiveDropdown(null);

        // Auto-focus quantity field
        setTimeout(() => {
            const qtyInput = document.getElementById(`qty-${index}`);
            if (qtyInput) qtyInput.focus();
        }, 10);
    };

    const handleChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // Recalculate amount if rate or qty changes
        if (field === 'qty' || field === 'rate') {
            const qty = parseFloat(newItems[index].qty) || 0;
            const rate = parseFloat(newItems[index].rate) || 0;
            newItems[index].amount = (qty * rate).toFixed(2);
        }

        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { description: '', hsn: '', qty: '', rate: '', per: 'Nos', amount: '' }]);
    };

    const removeItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        // Clean up search state
        setProductSearch(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
        if (activeDropdown === index) setActiveDropdown(null);
    };

    const saveExampleProduct = async (item) => {
        if (item.description && item.rate) {
            try {
                await createProduct({
                    id: Date.now().toString(),
                    description: item.description,
                    hsn: item.hsn,
                    rate: parseFloat(item.rate),
                    per: item.per
                });
                await loadProductData();
                alert('Product Saved for Future Use!');
            } catch (e) {
                console.error(e);
                alert('Failed to save product. Ensure the server is running.');
            }
        }
    };

    // Calculate sum of quantities to display at footer
    const totalQuantity = items.reduce((acc, item) => acc + (parseFloat(item.qty) || 0), 0);

    return (
        <div className="flex flex-col flex-grow relative">
            {!isPreviewMode && (
                <div className="flex justify-end mb-1 no-print">
                    <button onClick={addItem} className="text-xs flex items-center gap-1 btn-secondary py-1 px-2">
                        <Plus size={14} /> Add Row
                    </button>
                </div>
            )}

            <table className="ledger-table w-full flex-grow">
                <thead>
                    <tr>
                        <th className="w-10">S.No.</th>
                        <th className="text-left w-1/3">Product Description</th>
                        <th className="w-20">HSN/SAC Code</th>
                        <th className="w-16">Qty.</th>
                        <th className="w-24">Rate</th>
                        <th className="w-16">Per</th>
                        <th className="w-32">Amount</th>
                        {!isPreviewMode && <th className="w-10 no-print border-r-0">Act</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => {
                        const suggestions = getSuggestions(index);
                        const isOpen = activeDropdown === index && !isPreviewMode;

                        return (
                            <tr key={index}>
                                <td className="text-center text-gray-800 font-bold border-r border-gray-400">{index + 1}</td>

                                {/* Product Description cell with custom dropdown */}
                                <td className="border-r border-gray-400 relative" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                    {isPreviewMode ? (
                                        <span className="font-bold text-gray-800 text-sm">{item.description}</span>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={productSearch[index] ?? item.description}
                                                onChange={(e) => handleProductSearchChange(index, e.target.value)}
                                                onFocus={() => setActiveDropdown(index)}
                                                onBlur={() => setTimeout(() => setActiveDropdown(null), 180)}
                                                placeholder="Product Detail"
                                                autoComplete="off"
                                                className="font-bold text-gray-800 text-sm w-full p-0"
                                            />
                                            {isOpen && (
                                                <ul className="autocomplete-dropdown">
                                                    {suggestions.length > 0 ? (
                                                        suggestions.map((p, i) => (
                                                            <li
                                                                key={i}
                                                                className="autocomplete-item"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleSelectProduct(index, p);
                                                                }}
                                                            >
                                                                <span className="title">{p.description}</span>
                                                                <span className="subtitle">
                                                                    HSN: {p.hsn || '—'} &nbsp;|&nbsp; Rate: ₹{p.rate} / {p.per}
                                                                </span>
                                                            </li>
                                                        ))
                                                    ) : (
                                                        <li className="autocomplete-item no-match">No products found...</li>
                                                    )}
                                                </ul>
                                            )}
                                        </>
                                    )}
                                </td>

                                <td className="border-r border-gray-400">
                                    <input
                                        value={item.hsn}
                                        onChange={(e) => handleChange(index, 'hsn', e.target.value)}
                                        className="text-center font-medium text-gray-800 w-full"
                                        placeholder="HSN"
                                    />
                                </td>
                                <td className="border-r border-gray-400">
                                    <input
                                        id={`qty-${index}`}
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => handleChange(index, 'qty', e.target.value)}
                                        className="text-center font-medium text-gray-800 w-full"
                                    />
                                </td>
                                <td className="border-r border-gray-400">
                                    <input
                                        type="number"
                                        value={item.rate}
                                        onChange={(e) => handleChange(index, 'rate', e.target.value)}
                                        className="text-center font-medium text-gray-800 w-full"
                                    />
                                </td>
                                <td className="border-r border-gray-400">
                                    <input
                                        value={item.per}
                                        onChange={(e) => handleChange(index, 'per', e.target.value)}
                                        className="text-center font-medium text-gray-800 w-full"
                                    />
                                </td>
                                <td className="print:border-r-0">
                                    <input
                                        readOnly
                                        value={item.amount}
                                        className="text-right font-bold w-full text-blue-800 p-0"
                                        tabIndex={-1}
                                    />
                                </td>
                                {!isPreviewMode && (
                                    <td className="no-print text-center p-1">
                                        <div className="flex justify-center items-center gap-1">
                                            {items.length > 1 && (
                                                <button onClick={() => removeItem(index)} className="btn-danger p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                    {/* Single Spacer Row to push everything else up and fill the rest of the A4 page */}
                    {items.length < 12 && (
                        <tr style={{ height: `${Math.max(0, 280 - items.length * 42)}px` }}>
                            <td className="border-r border-gray-400"></td>
                            <td className="border-r border-gray-400"></td>
                            <td className="border-r border-gray-400"></td>
                            <td className="border-r border-gray-400"></td>
                            <td className="border-r border-gray-400"></td>
                            <td className="border-r border-gray-400"></td>
                            <td className="print:border-r-0"></td>
                            {!isPreviewMode && <td className="no-print border-r-0"></td>}
                        </tr>
                    )}

                    {/* Footer Row matching manual book total style */}
                    <tr className="bg-blue-50">
                        <td className="border-r border-gray-400"></td>
                        <td className="font-bold text-gray-600 text-right px-2 py-1 border-r border-gray-400">Total Quantity</td>
                        <td className="border-r border-gray-400"></td>
                        <td className="font-bold text-blue-700 text-center py-1 border-r border-gray-400">{totalQuantity > 0 ? totalQuantity : ''}</td>
                        <td className="border-r border-gray-400"></td>
                        <td className="border-r border-gray-400"></td>
                        <td className="font-bold text-right pt-1 pb-1 px-1 print:border-r-0">
                            <div className="w-full text-right">{/* Let Summary take care of the final grand totals mostly */}</div>
                        </td>
                        {!isPreviewMode && <td className="no-print border-r-0"></td>}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ProductTable;
