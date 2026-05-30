const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');

function registerIpcHandlers() {
    // 1. Fetch system installed printers list
    ipcMain.handle('get-printers', async (event) => {
        try {
            return await event.sender.getPrintersAsync();
        } catch (error) {
            console.error("Failed to query system printers:", error);
            return [];
        }
    });

    // 2. Generate PDF stream
    ipcMain.handle('print-pdf', async (event, options) => {
        try {
            const pdfBuffer = await event.sender.printToPDF(options);
            return pdfBuffer;
        } catch (error) {
            console.error("Failed to generate PDF from webContents:", error);
            throw error;
        }
    });

    // 3. Spool direct printer output
    ipcMain.handle('print-invoice', async (event, options) => {
        return new Promise((resolve) => {
            try {
                event.sender.print(options, (success, failureReason) => {
                    if (success) {
                        resolve({ success: true });
                    } else {
                        console.error("Printing failed:", failureReason);
                        resolve({ success: false, error: failureReason });
                    }
                });
            } catch (error) {
                console.error("Error spooling to printer:", error);
                resolve({ success: false, error: error.message });
            }
        });
    });

    // 4. Open native Save Dialog
    ipcMain.handle('show-save-dialog', async (event, options) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            return await dialog.showSaveDialog(window, options);
        } catch (error) {
            console.error("Failed to open save file dialog:", error);
            throw error;
        }
    });

    // 5. Write binary buffer stream to file
    ipcMain.handle('save-pdf-file', async (event, filePath, buffer) => {
        try {
            await fs.promises.writeFile(filePath, Buffer.from(buffer));
            return { success: true };
        } catch (error) {
            console.error("Failed to save PDF to path:", error);
            throw error;
        }
    });
}

module.exports = {
    registerIpcHandlers
};
