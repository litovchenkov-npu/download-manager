const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

// download manager class
class Downloader {
    // constructor to initialize download directory and map for download items
    constructor() {
        this.downloadDir = path.join(os.homedir(), 'Downloads'); // set the download directory to the user's Downloads folder
        this.downloadItems = new Map(); // create a map to store download items by their index
    }

    // download process handler
    async download(url, index, webContents) {
        try {
            // initiate the download process and handle progress and completion
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
    
            const handleWillDownload = (event, item) => {
                // remove the event listener to prevent memory leaks
                session.defaultSession.off('will-download', handleWillDownload);
                const filePath = path.join(this.downloadDir, item.getFilename());
                item.setSavePath(filePath); // set the file path for the download
    
                // store the download item in the map
                this.downloadItems.set(index, item);
    
                item.once('done', (event, state) => {
                    if (state === 'completed') {
                        resolve(item); // resolve the promise when the download is complete
                    } else {
                        reject(new Error(`Download failed: ${state}`)); // reject if the download fails
                    }
                });
    
                resolve(item); // resolve the promise with the download item
            };
    
            // listen for the 'will-download' event to start the download
            session.defaultSession.once('will-download', handleWillDownload);
    
            // load the URL to trigger the download
            win.loadURL(url);
    
            // handle the case where the window is closed before the download starts
            win.once('closed', () => {
                session.defaultSession.off('will-download', handleWillDownload);
                reject(new Error('Window closed before download started')); // reject if the window is closed
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
                const progress = Math.round((currentReceivedBytes / totalBytes) * 100); // calculate the download progress

                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTime) / 1000;
                const speed = (currentReceivedBytes - receivedBytes) / (1024 * 1024 * elapsedTime); // calculate download speed in MB/s
                const estimatedTime = (totalBytes - currentReceivedBytes) / (speed * 1024 * 1024); // calculate estimated time remaining

                receivedBytes = currentReceivedBytes;
                startTime = currentTime;

                // send progress updates to the renderer process
                if (!webContents.isDestroyed()) {
                    webContents.send('downloadProgress', {
                        index,
                        progress,
                        filename: item.getFilename(),
                        fileSize: totalBytes / (1024 * 1024 * 1024), // file size in GB
                        speed,
                        time: this.formatTime(estimatedTime) // formatted estimated time remaining
                    });
                }
            }
        });
    }

    // method to handle the download completion
    handleFinish(item, filePath, index) {
        return new Promise((resolve, reject) => {
            item.once('done', (event, state) => {
                // remove the item from the map once the download is done
                this.downloadItems.delete(index);
                if (state === 'completed') {
                    resolve(index); // resolve the promise if the download is completed
                } else {
                    // if the download failed, delete the incomplete file
                    fs.unlink(filePath, () => {
                        reject(new Error(`Download failed: ${state}`)); // reject if the download fails
                    });
                }
            });
        });
    }

    // method to format time from seconds to HH:MM:SS
    formatTime(seconds) {
        if (seconds === Infinity) {
            return "Awaiting..."; // if the time is infinite, return "Awaiting..."
        }
        if (!seconds) {
            return "Done"; // if no time is left, return "Done"
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`; // return formatted time
        }
    }
}

module.exports = Downloader;