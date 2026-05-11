const { app } = require('electron');
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const processes = [];

// Determine paths safely regardless of dev/prod
const isDev = !app.isPackaged;
const resourcesPath = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const userDataPath = app.getPath('userData');
const documentsPath = app.getPath('documents');

// Setup DB directory in userData so it remains writable after packaging
const dbDir = path.join(userDataPath, 'databases');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure invoice storage directory exists in Documents
const invoiceStorageDir = path.join(documentsPath, 'billing_invoices');
if (!fs.existsSync(invoiceStorageDir)) {
    fs.mkdirSync(invoiceStorageDir, { recursive: true });
}

/**
 * Copies a database file from resources to userData if it doesn't already exist.
 * This guarantees the file is writable in production.
 */
function ensureWritableDB(filename) {
    const sourcePath = path.join(resourcesPath, filename);
    const destPath = path.join(dbDir, filename);

    if (!fs.existsSync(destPath)) {
        if (fs.existsSync(sourcePath)) {
            console.log(`Copying ${filename} to writable storage...`);
            fs.copyFileSync(sourcePath, destPath);
        } else {
            // If the source doesn't exist (e.g. fresh start), create an empty one
            const defaultStructure = filename === 'customerdb.json' ? { customers: [] } 
                                 : filename === 'productdb.json' ? { products: [] }
                                 : { invoices: [] };
            fs.writeFileSync(destPath, JSON.stringify(defaultStructure, null, 2), 'utf-8');
            console.log(`Created new empty ${filename} in writable storage.`);
        }
    }
    return destPath;
}

function spawnJsonServer(dbPath, port) {
    console.log(`Spawning json-server for ${path.basename(dbPath)} on port ${port}...`);
    try {
        const jsonServerBin = require.resolve('json-server/lib/bin.js');
        const child = fork(jsonServerBin, ['--watch', path.basename(dbPath), '--port', port.toString()], {
            detached: false,
            cwd: path.dirname(dbPath),
            stdio: 'pipe',
            env: { ...process.env }
        });

        child.stdout.on('data', (data) => console.log(`[json-server ${port}]: ${data}`));
        child.stderr.on('data', (data) => console.error(`[json-server ${port} ERR]: ${data}`));
        child.on('error', (err) => console.error(`Failed to start json-server on port ${port}:`, err));

        processes.push(child);
    } catch (err) {
        console.error(`Error resolving json-server executable for port ${port}:`, err);
    }
}

function spawnExpressServer() {
    console.log(`Spawning Express server...`);
    // In Electron, child_process.fork supports running scripts from inside app.asar
    const serverJsPath = path.join(__dirname, 'server.cjs');

    if (!fs.existsSync(serverJsPath)) {
        console.error(`Express server file not found at: ${serverJsPath}`);
        return;
    }

    const child = fork(serverJsPath, [], {
        detached: false,
        stdio: 'pipe',
        env: {
            ...process.env,
            INVOICE_STORAGE_PATH: invoiceStorageDir
        }
    });

    child.stdout.on('data', (data) => console.log(`[Express]: ${data}`));
    child.stderr.on('data', (data) => console.error(`[Express ERR]: ${data}`));
    child.on('error', (err) => console.error(`Failed to start Express server:`, err));

    processes.push(child);
}

function startServers() {
    // 1. Prepare writable DBs
    const customerDbPath = ensureWritableDB('customerdb.json');
    const productDbPath = ensureWritableDB('productdb.json');
    const invoiceDbPath = ensureWritableDB('invoicedb.json');

    // 2. Start all processes
    spawnJsonServer(customerDbPath, 3001);
    spawnJsonServer(productDbPath, 3003);
    spawnJsonServer(invoiceDbPath, 3004);
    
    spawnExpressServer(); // Runs on port 3002 internally

    console.log('All backend servers have been initialized.');
}

function stopServers() {
    console.log('Stopping all backend servers...');
    processes.forEach((proc, index) => {
        if (!proc.killed) {
            console.log(`Killing process ${index}...`);
            proc.kill();
        }
    });
}

module.exports = {
    startServers,
    stopServers
};
