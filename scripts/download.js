const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

// download manager class
class Downloader {
    constructor() {
        this.downloadDir = path.join(os.homedir(), 'Downloads'); // set the download directory to the user's Downloads folder
        this.downloadItems = new Map(); // create a map to store download items by their index
        this.windows = new Set(); // keep track of windows to ensure they are properly closed
    }

    // download process handler
    async download(url, index, webContents) {
        try {
            const downloadItem = await this.initiateDownload(url, index, webContents);
            if (!downloadItem) return;

            const filePath = path.join(this.downloadDir, downloadItem.getFilename());
            this.handleProgress(downloadItem, index, webContents);
            await this.handleFinish(downloadItem, filePath, index, webContents);

            return index; // return the index on successful download
        } catch (error) {
            console.error(error);
        }
    }

    // pause method
    async pause(index) {
        const item = this.downloadItems.get(index);
        if (item) {
            await item.pause(); // pause the download item if it exists
        }
    }

    // resume method
    async resume(index) {
        const item = this.downloadItems.get(index);
        if (item) {
            await item.resume(); // resume the download item if it exists
        }
    }

    // download initialization method
    initiateDownload(url, index) {
        return new Promise((resolve, reject) => {
            const win = new BrowserWindow({ show: false }); // create a hidden BrowserWindow to initiate the download
            this.windows.add(win);

            const handleWillDownload = (event, item) => {
                session.defaultSession.off('will-download', handleWillDownload);

                const filePath = path.join(this.downloadDir, item.getFilename());
                item.setSavePath(filePath); // set the file path for the download

                this.downloadItems.set(index, item);

                item.once('done', (event, state) => {
                    this.downloadItems.delete(index);
                    this.windows.delete(win);
                    win.close();

                    if (state === 'completed') {
                        resolve(item);
                    } else {
                        reject(new Error(`Download failed: ${state}`));
                    }
                });

                resolve(item);
            };

            session.defaultSession.once('will-download', handleWillDownload);

            win.loadURL(url);

            win.once('closed', () => {
                session.defaultSession.off('will-download', handleWillDownload);
                this.windows.delete(win);
                reject(new Error('Window closed before download started'));
            });
        });
    }

    // method to handle download progress update
    handleProgress(item, index, webContents) {
        let startTime = Date.now();
        let receivedBytes = 0;

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                console.log('Download is interrupted');
            } else if (state === 'progressing') {
                const currentReceivedBytes = item.getReceivedBytes();
                const totalBytes = item.getTotalBytes();
                const progress = Math.round((currentReceivedBytes / totalBytes) * 100);

                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTime) / 1000;
                const speed = (currentReceivedBytes - receivedBytes) / (1024 * 1024 * elapsedTime);
                const estimatedTime = (totalBytes - currentReceivedBytes) / (speed * 1024 * 1024);

                receivedBytes = currentReceivedBytes;
                startTime = currentTime;

                if (!webContents.isDestroyed()) {
                    webContents.send('downloadProgress', {
                        index,
                        progress,
                        filename: item.getFilename(),
                        fileSize: totalBytes / (1024 * 1024 * 1024),
                        speed,
                        time: this.formatTime(estimatedTime)
                    });
                }
            }
        });
    }

    // method to handle the download completion
    handleFinish(item, filePath, index) {
        return new Promise((resolve, reject) => {
            item.once('done', (event, state) => {
                this.downloadItems.delete(index);
                if (state === 'completed') {
                    resolve(index);
                } else {
                    fs.unlink(filePath, () => {
                        reject(new Error(`Download failed: ${state}`));
                    });
                }
            });
        });
    }

    // method to format time from seconds to HH:MM:SS
    formatTime(seconds) {
        if (seconds === Infinity) {
            return "Awaiting...";
        }
        if (!seconds) {
            return "Done";
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        }
    }
}

module.exports = Downloader;