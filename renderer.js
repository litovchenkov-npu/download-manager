const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadInput = document.getElementById('downloadInput');
    const downloadList = document.getElementById('downloadList');

    let generateIndex = (() => {
        let index = 0;
        return () => index++;
    })();

    downloadBtn.addEventListener('click', () => {
        const inputValue = downloadInput.value.trim();
        if (inputValue) {
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(inputValue)) {
                console.error('Invalid URL entered');
                return;
            }

            downloadInput.value = '';

            const index = generateIndex();

            const newRow = downloadList.insertRow();
            const filenameCell = newRow.insertCell(0);
            const progressCell = newRow.insertCell(1);
            const sizeCell = newRow.insertCell(2);
            const speedCell = newRow.insertCell(3);
            const timeCell = newRow.insertCell(4);
            const pauseBtnCell = newRow.insertCell(5);
            const resumeBtnCell = newRow.insertCell(6);

            const pauseBtn = document.createElement('button');
            pauseBtn.textContent = 'Pause';
            pauseBtn.addEventListener('click', () => {
                ipcRenderer.send('pauseDownload', index);
            });
            pauseBtnCell.appendChild(pauseBtn);

            const resumeBtn = document.createElement('button');
            resumeBtn.textContent = 'Resume';
            resumeBtn.addEventListener('click', () => {
                ipcRenderer.send('resumeDownload', index);
            });
            resumeBtnCell.appendChild(resumeBtn);

            ipcRenderer.send('inputValue', { url: inputValue, index });

        } else {
            console.error('Empty URL input');
        }
    });

    ipcRenderer.on('downloadProgress', (event, { index, progress, filename, fileSize, speed, time }) => {
        const rows = downloadList.rows;
        if (rows[index]) {
            rows[index].cells[0].textContent = filename;
            rows[index].cells[1].textContent = `${progress}%`;
            rows[index].cells[2].textContent = fileSize.toFixed(2);
            rows[index].cells[3].textContent = speed.toFixed(2);
            rows[index].cells[4].textContent = time;
        }
    });
});
