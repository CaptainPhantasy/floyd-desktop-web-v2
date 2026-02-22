const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;
let serverProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Detect if running in packaged app
const isPackaged = app.isPackaged;

function getServerPath() {
    if (isPackaged) {
        // In production, server is bundled with the app
        return path.join(process.resourcesPath, 'app', 'server', 'index.js');
    } else {
        // In development, use the built server
        return path.join(__dirname, '..', 'dist-server', 'index.js');
    }
}

function startBackendServer() {
    const serverPath = getServerPath();
    
    console.log('Starting Floyd Desktop server from:', serverPath);
    
    serverProcess = spawn('node', [serverPath], {
        cwd: isPackaged ? process.resourcesPath : path.join(__dirname, '..'),
        env: {
            ...process.env,
            NODE_ENV: isPackaged ? 'production' : 'development',
            FLOYD_DESKTOP_MODE: 'electron'
        },
        stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server] ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
    });

    serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
            console.error('Server crashed, restarting...');
            setTimeout(startBackendServer, 2000);
        }
    });

    // Give server time to start
    return new Promise((resolve) => {
        setTimeout(resolve, 2000);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        backgroundColor: '#0f172a',
        show: false,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    // Show window when ready to prevent flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Load the app
    if (isDev) {
        // In development, load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // In production, load the built files
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// App lifecycle
app.whenReady().then(async () => {
    // Start backend server first
    await startBackendServer();
    
    // Then create the window
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Quit on all platforms except macOS (keep running for menu bar)
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Shutdown server when app quits
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-platform', () => {
    return process.platform;
});

ipcMain.handle('get-app-path', () => {
    return app.getAppPath();
});

ipcMain.handle('is-packaged', () => {
    return app.isPackaged;
});

ipcMain.handle('get-locale', () => {
    return app.getLocale();
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

// Handle certificate errors (for development only)
if (isDev) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}
