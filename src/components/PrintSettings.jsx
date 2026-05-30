import React from 'react';
import { ChevronDown } from 'lucide-react';

const PrintSettings = ({
    destination,
    setDestination,
    printers,
    isPrintersLoading,
    copies,
    setCopies,
    pages,
    setPages,
    layout,
    setLayout,
    paperSize,
    setPaperSize,
    margins,
    setMargins,
    customMarginValue,
    setCustomMarginValue,
    scale,
    setScale,
    scalePercentage,
    setScalePercentage,
    backgroundGraphics,
    setBackgroundGraphics,
    showMoreSettings,
    setShowMoreSettings,
    isLoading,
    loadingMsg,
    handleSaveAsPDF,
    handlePrint,
    handleCancel
}) => {
    return (
        <div className="preview-sidebar" style={{ position: 'relative' }}>
            {isLoading && (
                <div className="preview-loading-overlay" style={{ borderRadius: '0' }}>
                    <div className="loader-spinner"></div>
                    <div className="loader-text" style={{ fontSize: '0.9rem', textAlign: 'center', padding: '0 10px' }}>{loadingMsg}</div>
                </div>
            )}
            <div className="sidebar-header">
                <h2>Print</h2>
                <span className="page-count-badge">
                    {pages === 'all' ? '3 pages' : '1 page'}
                </span>
            </div>

            <div className="sidebar-scrollable-settings">
                {/* Destination Selection */}
                <div className="setting-group">
                    <label>Destination</label>
                    <select 
                        className="setting-input setting-select"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        disabled={isPrintersLoading}
                    >
                        {isPrintersLoading ? (
                            <option disabled value="">Detecting printers...</option>
                        ) : printers.length === 0 ? (
                            <option disabled value="">No printers found</option>
                        ) : (
                            printers.map((printer) => (
                                <option
                                    key={printer.name}
                                    value={printer.name}
                                >
                                    {printer.isVirtual ? printer.name : `🖨️ ${printer.name}`}
                                    {printer.isDefault ? ' (Default)' : ''}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                {/* Copies Count (Only if printer chosen) */}
                {destination !== 'PDF' && destination !== 'Save as PDF' && (
                    <div className="setting-group">
                        <label>Copies</label>
                        <input 
                            type="number" 
                            className="setting-input" 
                            min="1" 
                            value={copies}
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                    </div>
                )}

                {/* Page Options */}
                <div className="setting-group">
                    <label>Pages</label>
                    <select 
                        className="setting-input setting-select"
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                    >
                        <option value="all">All Copies (Original, Duplicate, Triplicate)</option>
                        <option value="single">Original Copy Only</option>
                    </select>
                </div>

                {/* Layout Orientation */}
                <div className="setting-group">
                    <label>Layout</label>
                    <select 
                        className="setting-input setting-select"
                        value={layout}
                        onChange={(e) => setLayout(e.target.value)}
                    >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </div>

                {/* Collapsible More Settings */}
                <div 
                    className="more-settings-toggle"
                    onClick={() => setShowMoreSettings(!showMoreSettings)}
                >
                    <span>More settings</span>
                    <span className={`chevron-icon ${showMoreSettings ? 'open' : ''}`}>
                        <ChevronDown size={16} />
                    </span>
                </div>

                {showMoreSettings && (
                    <div className="more-settings-content">
                        {/* Paper Size */}
                        <div className="setting-group">
                            <label>Paper size</label>
                            <select 
                                className="setting-input setting-select"
                                value={paperSize}
                                onChange={(e) => setPaperSize(e.target.value)}
                            >
                                <option value="A4">A4 (210mm x 297mm)</option>
                                <option value="Letter">Letter (8.5" x 11")</option>
                                <option value="Legal">Legal (8.5" x 14")</option>
                            </select>
                        </div>

                        {/* Margins */}
                        <div className="setting-group align-start">
                            <label>Margins</label>
                            <div className="setting-control-column">
                                <select 
                                    className="setting-input setting-select"
                                    value={margins}
                                    onChange={(e) => setMargins(e.target.value)}
                                >
                                    <option value="default">Default</option>
                                    <option value="none">None</option>
                                    <option value="minimum">Minimum</option>
                                    <option value="custom">Custom</option>
                                </select>

                                {/* Custom Margins Input Grid */}
                                {margins === 'custom' && (
                                    <div className="custom-margins-grid">
                                        <div className="margin-field">
                                            <span>Top (mm)</span>
                                            <input 
                                                type="number" 
                                                value={customMarginValue.top} 
                                                onChange={(e) => setCustomMarginValue(prev => ({ ...prev, top: Math.max(0, parseInt(e.target.value) || 0) }))}
                                            />
                                        </div>
                                        <div className="margin-field">
                                            <span>Right (mm)</span>
                                            <input 
                                                type="number" 
                                                value={customMarginValue.right} 
                                                onChange={(e) => setCustomMarginValue(prev => ({ ...prev, right: Math.max(0, parseInt(e.target.value) || 0) }))}
                                            />
                                        </div>
                                        <div className="margin-field">
                                            <span>Bottom (mm)</span>
                                            <input 
                                                type="number" 
                                                value={customMarginValue.bottom} 
                                                onChange={(e) => setCustomMarginValue(prev => ({ ...prev, bottom: Math.max(0, parseInt(e.target.value) || 0) }))}
                                            />
                                        </div>
                                        <div className="margin-field">
                                            <span>Left (mm)</span>
                                            <input 
                                                type="number" 
                                                value={customMarginValue.left} 
                                                onChange={(e) => setCustomMarginValue(prev => ({ ...prev, left: Math.max(0, parseInt(e.target.value) || 0) }))}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scale */}
                        <div className="setting-group align-start">
                            <label>Scale</label>
                            <div className="setting-control-column">
                                <select 
                                    className="setting-input setting-select"
                                    value={scale}
                                    onChange={(e) => {
                                        setScale(e.target.value);
                                        if (e.target.value === 'default') {
                                            setScalePercentage(100);
                                        }
                                    }}
                                >
                                    <option value="default">Default</option>
                                    <option value="custom">Custom</option>
                                </select>
                                {scale === 'custom' && (
                                    <input 
                                        type="number" 
                                        className="setting-input" 
                                        min="10" 
                                        max="200" 
                                        value={scalePercentage}
                                        onChange={(e) => setScalePercentage(Math.max(10, Math.min(200, parseInt(e.target.value) || 100)))}
                                        style={{ marginTop: '8px' }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Options */}
                        <div className="setting-group align-start">
                            <label>Options</label>
                            <div className="setting-control-column">
                                <label className="setting-checkbox-row">
                                    <input 
                                        type="checkbox" 
                                        checked={backgroundGraphics}
                                        onChange={(e) => setBackgroundGraphics(e.target.checked)}
                                    />
                                    <span>Background graphics</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer buttons */}
            <div className="sidebar-actions-footer">
                {destination === 'PDF' || destination === 'Save as PDF' ? (
                    <button 
                        className="btn-print-action btn-print-primary" 
                        onClick={handleSaveAsPDF}
                        disabled={isLoading}
                    >
                        Save
                    </button>
                ) : (
                    <button 
                        className="btn-print-action btn-print-primary" 
                        onClick={handlePrint}
                        disabled={isLoading}
                    >
                        Print
                    </button>
                )}
                <button 
                    className="btn-print-action btn-print-secondary" 
                    onClick={handleCancel}
                    disabled={isLoading}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default React.memo(PrintSettings);
