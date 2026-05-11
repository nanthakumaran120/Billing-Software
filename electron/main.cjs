const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const waitOn = require('wait-on');
const { startServers, stopServers } = require('./serverManager.cjs');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.error("Another instance of the app is already running. Quitting...");
    app.quit();
} else {
    // We are the primary instance
    let mainWindow;

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
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
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false // Required for loading local assets smoothly
            }
        });

        mainWindow.setMenuBarVisibility(false); // Clean UI

        try {
            // Wait for all backend servers to be ready before loading the frontend
            console.log("Waiting for backend servers to boot...");
            await waitOn({
                resources: [
                    'tcp:3001', // customerdb
                    'tcp:3002', // express server
                    'tcp:3003', // productdb
                    'tcp:3004'  // invoicedb
                ],
                timeout: 10000 // 10 seconds timeout
            });
            console.log("All backend servers are responsive!");
        } catch (err) {
            console.error("Timeout waiting for servers to start. Proceeding anyway, but UI may fail.", err);
        }

        if (isDev) {
            console.log('Running in Development mode');
            mainWindow.loadURL('http://localhost:3005');
            // Open the DevTools.
            mainWindow.webContents.openDevTools();
        } else {
            console.log('Running in Production mode');
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
            mainWindow.webContents.openDevTools();
        }
    }

    app.whenReady().then(() => {
        // Start background processes before creating the window
        startServers();
        createWindow();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    // Graceful Shutdown to prevent zombie processes
    app.on('before-quit', () => {
        console.log("App is shutting down...");
        stopServers();
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
