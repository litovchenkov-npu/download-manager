const { app, BrowserWindow, ipcMain } = require('electron');
const Downloader = require('./scripts/download');

const createWindow = () => {
    const win = new BrowserWindow({
        icon: './icon.ico',
        width: 1024,
        height: 600,
        minWidth: 1024,
        minHeight: 600,
        center: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    win.loadFile('index.html');

    return win;
};

let mainWindow;
const downloader = new Downloader();

app.whenReady().then(() => {
    mainWindow = createWindow();

    ipcMain.on('inputValue', (event, data) => {
        downloader.download(data.url, data.index, mainWindow.webContents);
    });

    ipcMain.on('pauseDownload', (event, index) => {
        downloader.pause(index);
    });

    ipcMain.on('resumeDownload', (event, index) => {
        downloader.resume(index);
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', (event) => {
        if (downloader.windows.size > 0) {
            event.preventDefault();

            const closePromises = Array.from(downloader.windows).map((win) => {
                return new Promise((resolve) => {
                    win.on('closed', resolve);
                    win.close();
                });
            });

            Promise.all(closePromises).then(() => {
                app.quit();
            });
        }
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
    }
});