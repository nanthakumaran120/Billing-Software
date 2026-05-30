const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const { fork } = require('child_process');
const fs = require('fs');
const { registerIpcHandlers } = require('./ipcPrint.cjs');

// Register IPC handlers immediately on launch
registerIpcHandlers();

// Register logo path IPC handler
const logoPath = isDev
    ? path.join(__dirname, "../public/assets/perumal_logo.png")
    : (fs.existsSync(path.join(process.resourcesPath, "public/assets/perumal_logo.png"))
        ? path.join(process.resourcesPath, "public/assets/perumal_logo.png")
        : path.join(__dirname, "../public/assets/perumal_logo.png"));

ipcMain.on('get-logo-path', (event) => {
    event.returnValue = logoPath;
});

let serverProcess = null;
let mainWindow = null;

// Setup directories safely in User Data for production writable storage
const userDataPath = app.getPath('userData');
const dbDir = path.join(userDataPath, 'databases');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const documentsPath = app.getPath('documents');
const invoiceStorageDir = path.join(documentsPath, 'billing_invoices');
if (!fs.existsSync(invoiceStorageDir)) {
    fs.mkdirSync(invoiceStorageDir, { recursive: true });
}

// Writable user databases copy logic
const initialDataDir = isDev ? path.join(__dirname, '../data') : path.join(process.resourcesPath, 'data');
const jsonFiles = ['customerdb.json', 'productdb.json', 'invoicedb.json'];

jsonFiles.forEach(file => {
    const destPath = path.join(userDataPath, file);
    if (!fs.existsSync(destPath)) {
        const srcPath = path.join(initialDataDir, file);
        if (fs.existsSync(srcPath)) {
            try {
                fs.copyFileSync(srcPath, destPath);
                console.log(`Copied default ${file} to userData: ${destPath}`);
            } catch (err) {
                console.error(`Failed to copy ${file}:`, err);
            }
        } else {
            console.warn(`Source file not found for copy: ${srcPath}`);
        }
    }
});

// Ensure database file exists/migrates
const resourcesPath = isDev ? path.join(__dirname, '..') : process.resourcesPath;

function startExpressServer() {
    console.log("Starting backend Express server process...");
    
    // In production, server.js is in app.asar (which fork can run natively)
    const serverPath = path.join(__dirname, '../server.js');
    
    serverProcess = fork(serverPath, [], {
        detached: false,
        stdio: 'pipe',
        env: {
            ...process.env,
            INVOICE_STORAGE_PATH: invoiceStorageDir,
            SQLITE_DB_DIR: dbDir,
            JSON_DB_DIR: userDataPath
        }
    });

    serverProcess.stdout.on('data', (data) => console.log(`[Express]: ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[Express ERR]: ${data}`));
    serverProcess.on('error', (err) => console.error(`Failed to start Express backend:`, err));
}

function stopExpressServer() {
    if (serverProcess && !serverProcess.killed) {
        console.log("Stopping backend Express server...");
        serverProcess.kill();
    }
}

// Single instance lock to prevent duplicate app running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.error("Another instance of the app is already running. Quitting...");
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    async function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            title: 'Srinivasa Billing',
            show: false, // hidden initially
            backgroundColor: '#ffffff', // prevent white screen flash
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false // Required for loading local assets smoothly
            }
        });

        mainWindow.setMenuBarVisibility(false);

        // Show window only when ready-to-show to prevent visual flash
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });

        if (isDev) {
            console.log('Running in Development mode');
            mainWindow.loadURL('http://localhost:3005');
            mainWindow.webContents.openDevTools();
        } else {
            console.log('Running in Production mode');
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        }
    }

    app.whenReady().then(() => {
        // Start backend Express server
        startExpressServer();
        createWindow();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('before-quit', () => {
        stopExpressServer();
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
