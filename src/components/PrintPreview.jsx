import React, { useState, useEffect, useRef } from 'react';
import Header from './Header';
import CustomerSection from './CustomerSection';
import ProductTable from './ProductTable';
import SummarySection from './SummarySection';
import PrintSettings from './PrintSettings';
import { ZoomIn, ZoomOut, Check, Printer, Save, X, ChevronDown } from 'lucide-react';
import { uploadPDFToServer } from '../services/api';

const PrintPreview = ({ customer, items, invoiceDetails, onCancel, onSaveAndReset }) => {
    const [printers, setPrinters] = useState([]);
    const [isPrintersLoading, setIsPrintersLoading] = useState(true);
    const destinationRef = useRef('Save as PDF');
    const [destination, setDestination] = useState('Save as PDF');
    const [pages, setPages] = useState('all');
    const [customPagesVal, setCustomPagesVal] = useState('');
    const [layout, setLayout] = useState('portrait');
    const [paperSize, setPaperSize] = useState('A4');
    const [margins, setMargins] = useState('default');
    const [customMarginValue, setCustomMarginValue] = useState({ top: 15, bottom: 15, left: 15, right: 15 });
    const [scale, setScale] = useState('default');
    const [scalePercentage, setScalePercentage] = useState(100);
    const [copies, setCopies] = useState(1);
    const [backgroundGraphics, setBackgroundGraphics] = useState(true);
    const [zoom, setZoom] = useState(75);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Generating preview...');
    const [showMoreSettings, setShowMoreSettings] = useState(false);

    const previewContainerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        let isFirst = true;

        const loadPrinters = async () => {
            try {
                if (!window.electron || !window.electron.getPrinters) return;

                const printerList = await window.electron.getPrinters();
                if (!isMounted) return;

                const savePDFOption = { name: 'Save as PDF', isVirtual: true };

                // Deduplicate by name
                const seen = new Set();
                const unique = printerList.filter(p => {
                    if (seen.has(p.name)) return false;
                    seen.add(p.name);
                    return true;
                });

                const sortedPrinters = [
                    savePDFOption,
                    ...unique.sort((a, b) => b.isDefault - a.isDefault)
                ];

                setPrinters(sortedPrinters);
                setIsPrintersLoading(false);

                const currentDest = destinationRef.current;
                const stillAvailable = sortedPrinters.some(p => p.name === currentDest);

                if (isFirst) {
                    // First load: pick default physical printer or Save as PDF
                    const defaultPrinter = sortedPrinters.find(p => p.isDefault);
                    const initialDest = defaultPrinter ? defaultPrinter.name : 'Save as PDF';
                    destinationRef.current = initialDest;
                    setDestination(initialDest);
                    isFirst = false;
                } else if (!stillAvailable) {
                    // Previously selected printer was disconnected — fall back
                    const defaultPrinter = sortedPrinters.find(p => p.isDefault);
                    const fallback = defaultPrinter ? defaultPrinter.name : 'Save as PDF';
                    destinationRef.current = fallback;
                    setDestination(fallback);
                }
            } catch (err) {
                console.warn('Failed to fetch system printers:', err);
                if (isMounted) setIsPrintersLoading(false);
            } finally {
                if (isMounted) {
                    setTimeout(() => setIsInitializing(false), 600);
                }
            }
        };

        loadPrinters();

        // Refresh every 5 seconds to detect newly connected / disconnected printers
        const intervalId = setInterval(loadPrinters, 5000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        if (!isInitializing) {
            // Auto save PDF silently in background as soon as preview is fully loaded and ready
            savePDFSilently();
        }
    }, [isInitializing]);

    // Margins styling
    const getMarginStyle = () => {
        if (margins === 'none') return '0mm';
        if (margins === 'minimum') return '5mm';
        if (margins === 'custom') {
            return `${customMarginValue.top}mm ${customMarginValue.right}mm ${customMarginValue.bottom}mm ${customMarginValue.left}mm`;
        }
        return '12mm'; // Default standard print margin
    };

    const savePDFSilently = async () => {
        if (!window.electron || !window.electron.printPDF) {
            console.warn("Electron API not available for silent PDF generation.");
            return false;
        }
        try {
            const printOptions = {
                pageSize: paperSize,
                landscape: layout === 'landscape',
                marginsType: margins === 'none' ? 1 : margins === 'minimum' ? 2 : margins === 'custom' ? 3 : 0,
                margins: margins === 'custom' ? customMarginValue : undefined,
                printBackground: backgroundGraphics,
                pageRanges: '1'
            };
            
            const pdfBuffer = await window.electron.printPDF(printOptions);
            const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
            
            await uploadPDFToServer(
                pdfBlob, 
                invoiceDetails.invoiceNo, 
                customer.name, 
                invoiceDetails.date
            );
            return true;
        } catch (err) {
            console.error("Failed to save PDF silently:", err);
            return false;
        }
    };

    const getFriendlyErrorMessage = (error) => {
        if (!error) return "The printer is currently offline, busy, or disconnected. Please check the connections.";
        const errLower = error.toLowerCase();
        if (errLower.includes("not found") || errLower.includes("not-found") || errLower.includes("invalid printer") || errLower.includes("unknown printer")) {
            return "The selected printer could not be found. Please check if the printer is plugged in and recognized by Windows.";
        }
        if (errLower.includes("offline") || errLower.includes("busy")) {
            return "The printer is offline or busy. Please check the power status and local printer queue.";
        }
        if (errLower.includes("denied") || errLower.includes("permission")) {
            return "Permission denied by Windows print manager. Try running the application as administrator.";
        }
        return `Printing failed: ${error}. Please check the printer connections and try again.`;
    };

    const handlePrint = async () => {
        setIsLoading(true);
        setLoadingMsg("Saving order and spooling to printer...");
        try {
            // First save PDF silently in the background
            await savePDFSilently();

            if (destination === 'PDF' || destination === 'Save as PDF') {
                await handleSaveAsPDFInternal();
            } else {
                const options = {
                    silent: false,
                    deviceName: destination,
                    copies: parseInt(copies) || 1,
                    pageSize: paperSize,
                    landscape: layout === 'landscape',
                    margins: {
                        marginType: margins === 'default' ? 'default' : margins === 'none' ? 'none' : margins === 'minimum' ? 'minimum' : 'custom',
                        ...customMarginValue
                    },
                    printBackground: backgroundGraphics
                };
                
                const result = await window.electron.printInvoice(options);
                if (result && result.success) {
                    alert("Order spooled to printer successfully!");
                    onSaveAndReset();
                } else {
                    alert(getFriendlyErrorMessage(result?.error));
                    onSaveAndReset();
                }
            }
        } catch (err) {
            console.error("Print error:", err);
            alert(`Direct printing error: ${err.message || 'System print server is unresponsive.'}`);
            onSaveAndReset();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAsPDFInternal = async () => {
        if (!window.electron || !window.electron.showSaveDialog) {
            alert("PDF saving is only supported inside the Electron desktop application.");
            return;
        }

        try {
            const saveOptions = {
                title: 'Save Order PDF',
                defaultPath: `Bill No ${invoiceDetails.invoiceNo}.pdf`,
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            };
            const fileResult = await window.electron.showSaveDialog(saveOptions);
            
            if (!fileResult.canceled && fileResult.filePath) {
                setIsLoading(true);
                setLoadingMsg("Generating high-fidelity PDF...");
                
                const printOptions = {
                    pageSize: paperSize,
                    landscape: layout === 'landscape',
                    marginsType: margins === 'none' ? 1 : margins === 'minimum' ? 2 : margins === 'custom' ? 3 : 0,
                    margins: margins === 'custom' ? customMarginValue : undefined,
                    printBackground: backgroundGraphics,
                    pageRanges: '1'
                };
                
                const pdfBuffer = await window.electron.printPDF(printOptions);
                const saveResult = await window.electron.savePDFFile(fileResult.filePath, pdfBuffer);
                
                if (saveResult && saveResult.success) {
                    // Upload to backend storage too
                    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
                    await uploadPDFToServer(pdfBlob, invoiceDetails.invoiceNo, customer.name, invoiceDetails.date);

                    alert("Order PDF successfully generated and saved!");
                    onSaveAndReset();
                }
            }
        } catch (error) {
            console.error("PDF Export failure:", error);
            alert(`Failed to export PDF: ${error.message || 'Check write folder permissions.'}`);
        }
    };

    const handleSaveAsPDF = async () => {
        await handleSaveAsPDFInternal();
    };

    const handleCancel = () => {
        onCancel();
    };

    const handleZoomIn = () => setZoom(prev => Math.min(150, prev + 10));
    const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 10));

    return (
        <div className="print-preview-overlay">
            <style>{`
                .print-preview-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 10000;
                    display: flex;
                    flex-direction: row;
                    background-color: #202124;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }

                .preview-workspace {
                    flex: 1;
                    background-color: #525659;
                    overflow: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    height: 100vh;
                    padding-bottom: 60px;
                }

                .preview-papers-scroll-container {
                    flex: 1;
                    width: 100%;
                    overflow-y: auto;
                    padding: 40px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 30px;
                }

                .preview-scale-wrapper {
                    transform-origin: top center;
                    transition: transform 0.15s ease-out;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                /* A4 Dimensions Screen styles */
                .preview-paper {
                    background: white;
                    box-sizing: border-box;
                    transition: all 0.2s ease-in-out;
                    position: relative;
                }

                .preview-paper.portrait {
                    width: 210mm;
                    height: 297mm;
                }

                .preview-paper.landscape {
                    width: 297mm;
                    height: 210mm;
                }

                /* Skeleton pulse loaders */
                .preview-skeleton-page {
                    background-color: #e8eaed;
                    border-radius: 4px;
                    display: flex;
                    flex-direction: column;
                    padding: 24px;
                    box-sizing: border-box;
                    animation: pulse 1.5s infinite ease-in-out;
                }

                .skeleton-line {
                    background-color: #dadce0;
                    border-radius: 4px;
                    height: 12px;
                    margin-bottom: 12px;
                }

                .skeleton-line.short { width: 40%; }
                .skeleton-line.medium { width: 70%; }
                .skeleton-line.long { width: 100%; }
                .skeleton-line.header { height: 32px; width: 60%; margin-bottom: 24px; }
                .skeleton-box { background-color: #dadce0; border-radius: 4px; height: 120px; width: 100%; margin-bottom: 20px; }

                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.95; }
                }

                /* Settings Sidebar Styling (Chrome-style Sidebar) */
                .preview-sidebar {
                    width: 340px;
                    height: 100vh;
                    background-color: #2c2c2f;
                    border-left: 1px solid #3c4043;
                    display: flex;
                    flex-direction: column;
                    color: #e8eaed;
                    box-shadow: -5px 0 25px rgba(0,0,0,0.3);
                    position: relative;
                }

                .sidebar-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #3c4043;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .sidebar-header h2 {
                    font-size: 1.25rem;
                    font-weight: 500;
                    margin: 0;
                    color: #e8eaed;
                }

                .sidebar-header .page-count-badge {
                    font-size: 0.85rem;
                    color: #9aa0a6;
                }

                .sidebar-scrollable-settings {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .setting-group {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    position: relative;
                }

                .setting-group.align-start {
                    align-items: flex-start;
                }

                .setting-group label {
                    font-size: 0.85rem;
                    font-weight: 400;
                    color: #e8eaed;
                    text-transform: none;
                    letter-spacing: normal;
                }

                .setting-control-column {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .setting-input {
                    background-color: #202124;
                    border: 1px solid #5f6368;
                    color: #e8eaed;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-size: 0.85rem;
                    outline: none;
                    transition: border-color 0.2s, background-color 0.2s;
                    width: 175px;
                    box-sizing: border-box;
                }

                .setting-input:focus {
                    border-color: #8ab4f8;
                    background-color: #292a2d;
                }

                .setting-select {
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23e8eaed' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    background-size: 14px;
                    padding-right: 32px;
                    cursor: pointer;
                }

                /* More settings toggle button styling */
                .more-settings-toggle {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    cursor: pointer;
                    font-size: 0.85rem;
                    color: #e8eaed;
                    user-select: none;
                    border-top: 1px solid #3c4043;
                    margin-top: 8px;
                    transition: color 0.2s;
                }

                .more-settings-toggle:hover {
                    color: #8ab4f8;
                }

                .more-settings-toggle .chevron-icon {
                    transition: transform 0.2s ease-in-out;
                    display: flex;
                    align-items: center;
                    color: #9aa0a6;
                }

                .more-settings-toggle .chevron-icon.open {
                    transform: rotate(180deg);
                }

                .more-settings-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    border-top: 1px solid rgba(60, 64, 67, 0.4);
                    padding-top: 12px;
                }

                .setting-checkbox-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    color: #e8eaed;
                }

                .setting-checkbox-row input {
                    width: 14px;
                    height: 14px;
                    accent-color: #8ab4f8;
                    cursor: pointer;
                }

                .custom-margins-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    background-color: #202124;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid #3c4043;
                    width: 175px;
                    box-sizing: border-box;
                    margin-top: 4px;
                }

                .margin-field {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .margin-field span {
                    font-size: 0.65rem;
                    color: #9aa0a6;
                }

                .margin-field input {
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid #5f6368;
                    color: white;
                    outline: none;
                    font-size: 0.8rem;
                    width: 100%;
                    padding: 2px 0;
                    box-sizing: border-box;
                }

                .margin-field input:focus {
                    border-bottom-color: #8ab4f8;
                }

                /* Bottom Toolbar Zoom controls */
                .preview-zoom-toolbar {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(47, 48, 51, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid #3d3e41;
                    padding: 8px 18px;
                    border-radius: 30px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    color: white;
                    z-index: 100;
                }

                .zoom-btn {
                    background: transparent;
                    border: none;
                    color: #9aa0a6;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }

                .zoom-btn:hover {
                    color: white;
                }

                .zoom-slider {
                    width: 100px;
                    accent-color: #8ab4f8;
                    cursor: pointer;
                }

                /* Sidebar Action Buttons Footer */
                .sidebar-actions-footer {
                    padding: 16px 20px;
                    border-top: 1px solid #3c4043;
                    display: flex;
                    flex-direction: row;
                    justify-content: flex-end;
                    gap: 8px;
                    background-color: #2c2c2f;
                }

                .btn-print-action {
                    padding: 8px 18px;
                    border-radius: 100px;
                    font-weight: 500;
                    font-size: 0.85rem;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: all 0.2s;
                }

                .btn-print-primary {
                    background-color: #8ab4f8;
                    color: #202124;
                }

                .btn-print-primary:hover {
                    background-color: #aecbfa;
                }

                .btn-print-secondary {
                    background-color: transparent;
                    border: 1px solid #5f6368;
                    color: #e8eaed;
                }

                .btn-print-secondary:hover {
                    background-color: rgba(255, 255, 255, 0.05);
                    border-color: #8ab4f8;
                }

                /* Loading overlay style */
                .preview-loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(32, 33, 36, 0.65);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    color: white;
                }

                .loader-spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid rgba(255, 255, 255, 0.1);
                    border-top-color: #8ab4f8;
                    border-radius: 50%;
                    animation: spin 1s infinite linear;
                    margin-bottom: 20px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .loader-text {
                    font-size: 1.1rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }

                /* PRINT-SPECIFIC CSS RULES TO PREVENT CLIPPING AND FORCE ALIGNMENTS */
                @media print {
                    #pdf-container { display: none !important; }
                    .action-bar { display: none !important; }
                    .preview-loading-overlay { display: none !important; }
                    
                    .print-preview-overlay {
                        position: static !important;
                        width: auto !important;
                        height: auto !important;
                        background-color: white !important;
                        display: block !important;
                    }
                    .preview-sidebar { display: none !important; }
                    .preview-zoom-toolbar { display: none !important; }
                    .preview-workspace { 
                        padding: 0 !important; 
                        background-color: white !important; 
                        overflow: visible !important; 
                        height: auto !important; 
                        position: static !important;
                        display: block !important;
                    }
                    .preview-papers-scroll-container { 
                        padding: 0 !important; 
                        gap: 0 !important; 
                        overflow: visible !important; 
                        display: block !important;
                    }
                    .preview-scale-wrapper { 
                        transform: none !important; 
                        margin: 0 !important; 
                        box-shadow: none !important; 
                        display: block !important;
                    }
                    .preview-paper { 
                        box-shadow: none !important; 
                        border: none !important; 
                        margin: 0 !important; 
                        page-break-after: always !important; 
                        break-inside: avoid !important; 
                        display: block !important;
                    }
                    .preview-paper:last-child { page-break-after: avoid !important; }
                    .master-invoice-box { border: none !important; }
                }
            `}</style>

            {/* Left side: Preview Workspace */}
            <div className="preview-workspace flex-1">
                <div className="preview-papers-scroll-container">
                    {isInitializing ? (
                        /* Pulsing Skeleton Loader instead of a blank container */
                        [1, 2].map(n => (
                            <div
                                key={n}
                                className="preview-scale-wrapper"
                                style={{ transform: `scale(${zoom / 100})`, marginBottom: `${(zoom / 100) * 10 - 200}px` }}
                            >
                                <div className={`preview-paper preview-skeleton-page ${layout}`}>
                                    <div className="skeleton-line header"></div>
                                    <div className="skeleton-line medium"></div>
                                    <div className="skeleton-line long"></div>
                                    <div className="skeleton-line short" style={{ marginBottom: '32px' }}></div>
                                    <div className="skeleton-box"></div>
                                    <div className="skeleton-line long"></div>
                                    <div className="skeleton-line long"></div>
                                    <div className="skeleton-line medium"></div>
                                </div>
                            </div>
                        ))
                    ) : (
                        /* Render standard Original, Duplicate, Triplicate pages */
                        (pages === 'all' ? ['Original', 'Duplicate', 'Triplicate'] : ['Original']).map((copyType) => (
                            <div
                                key={copyType}
                                className="preview-scale-wrapper"
                                style={{ transform: `scale(${zoom / 100})`, marginBottom: `${(zoom / 100) * 10 - 200}px` }}
                            >
                                <div 
                                    className={`preview-paper print-paper ${layout}`}
                                    style={{ padding: getMarginStyle() }}
                                >
                                    <div className="relative w-full h-0 z-10">
                                        <div className="absolute text-[9px] uppercase text-gray-800 tracking-wider font-bold" style={{ top: '-7mm', right: '0' }}>
                                            [ {copyType} ]
                                        </div>
                                    </div>
                                    <div className="master-invoice-box select-none pointer-events-none">
                                        <Header />
                                        <CustomerSection
                                            customer={customer}
                                            setCustomer={() => {}}
                                            invoiceDetails={invoiceDetails}
                                            setInvoiceDetails={() => {}}
                                            isPreviewMode={true}
                                        />
                                        <div className="table-section">
                                            <ProductTable
                                                items={items}
                                                setItems={() => {}}
                                                isPreviewMode={true}
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
                            </div>
                        ))
                    )}
                </div>

                {/* Bottom Zoom Slider */}
                <div className="preview-zoom-toolbar">
                    <button className="zoom-btn" onClick={handleZoomOut}><ZoomOut size={16} /></button>
                    <input 
                        type="range" 
                        className="zoom-slider" 
                        min="50" 
                        max="150" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseInt(e.target.value))}
                    />
                    <button className="zoom-btn" onClick={handleZoomIn}><ZoomIn size={16} /></button>
                    <span className="text-xs font-bold w-12 text-center">{zoom}%</span>
                </div>
            </div>

            {/* Right side: Chrome-style Settings Sidebar */}
            <PrintSettings
                destination={destination}
                setDestination={(val) => {
                    destinationRef.current = val;
                    setDestination(val);
                }}
                printers={printers}
                isPrintersLoading={isPrintersLoading}
                copies={copies}
                setCopies={setCopies}
                pages={pages}
                setPages={setPages}
                layout={layout}
                setLayout={setLayout}
                paperSize={paperSize}
                setPaperSize={setPaperSize}
                margins={margins}
                setMargins={setMargins}
                customMarginValue={customMarginValue}
                setCustomMarginValue={setCustomMarginValue}
                scale={scale}
                setScale={setScale}
                scalePercentage={scalePercentage}
                setScalePercentage={setScalePercentage}
                backgroundGraphics={backgroundGraphics}
                setBackgroundGraphics={setBackgroundGraphics}
                showMoreSettings={showMoreSettings}
                setShowMoreSettings={setShowMoreSettings}
                isLoading={isLoading}
                loadingMsg={loadingMsg}
                handleSaveAsPDF={handleSaveAsPDF}
                handlePrint={handlePrint}
                handleCancel={handleCancel}
            />
        </div>
    );
};

export default React.memo(PrintPreview);
