const { app, BrowserWindow, ipcMain } = require('electron');
const Downloader = require('./scripts/download');

const createWindow = () => {
    const win = new BrowserWindow({
        icon: './icon.png',
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

app.whenReady().then(() => {
    const mainWindow = createWindow();
    const downloader = new Downloader();

    ipcMain.on('inputValue', (event, data) => {
        downloader.download(data.url, data.index, mainWindow.webContents);
    });

    ipcMain.on('pauseDownload', (event, index) => {
        downloader.pause(index);
    });

    ipcMain.on('resumeDownload', (event, index) => {
        downloader.resume(index);
    });
});
