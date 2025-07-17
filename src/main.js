const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 550,
        height: 1000,
        minWidth: 550,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '..', 'assets', 'logo.svg'),
        titleBarStyle: 'default',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('start-copy', async (event, { sourcePath, targetPath, itemsList, ignoreExtensions }) => {
    try {
        const items = itemsList.split('\n').filter(item => item.trim() !== '');
        let totalItems = items.length;
        let processedItems = 0;
        let successCount = 0;
        let errorCount = 0;

        event.sender.send('log-message', `Starting copy operation...`);
        event.sender.send('log-message', `Source: ${sourcePath}`);
        event.sender.send('log-message', `Target: ${targetPath}`);
        event.sender.send('log-message', `Items to copy: ${totalItems}`);
        event.sender.send('log-message', `Ignore extensions: ${ignoreExtensions ? 'Yes' : 'No'}`);
        event.sender.send('log-message', '---');

        // Ensure target directory exists
        await fs.mkdir(targetPath, { recursive: true });

        for (const item of items) {
            const trimmedItem = item.trim();
            if (!trimmedItem) continue;

            try {
                event.sender.send('log-message', `Processing: ${trimmedItem}`);

                const foundPath = await findItem(sourcePath, trimmedItem, ignoreExtensions);

                if (foundPath) {
                    const targetItemPath = path.join(targetPath, path.basename(foundPath));

                    const stats = await fs.stat(foundPath);
                    if (stats.isDirectory()) {
                        await copyDirectory(foundPath, targetItemPath);
                        event.sender.send('log-message', `✓ Copied folder: ${trimmedItem} -> ${path.basename(foundPath)}`);
                    } else {
                        await fs.copyFile(foundPath, targetItemPath);
                        event.sender.send('log-message', `✓ Copied file: ${trimmedItem} -> ${path.basename(foundPath)}`);
                    }
                    successCount++;
                } else {
                    event.sender.send('log-message', `✗ Not found: ${trimmedItem}`);
                    errorCount++;
                }
            } catch (error) {
                event.sender.send('log-message', `✗ Error copying ${trimmedItem}: ${error.message}`);
                errorCount++;
            }

            processedItems++;
            event.sender.send('progress-update', { processed: processedItems, total: totalItems });
        }

        event.sender.send('log-message', '---');
        event.sender.send('log-message', `Copy operation completed!`);
        event.sender.send('log-message', `Success: ${successCount}, Errors: ${errorCount}, Total: ${totalItems}`);
        event.sender.send('copy-completed');

        return { success: true, successCount, errorCount, totalItems };
    } catch (error) {
        event.sender.send('log-message', `✗ Fatal error: ${error.message}`);
        event.sender.send('copy-completed');
        return { success: false, error: error.message };
    }
});

async function findItem(sourcePath, itemName, ignoreExtensions) {
    try {
        const items = await fs.readdir(sourcePath, { withFileTypes: true });

        // First try exact match
        for (const item of items) {
            if (item.name === itemName) {
                return path.join(sourcePath, item.name);
            }
        }

        // If ignoreExtensions is true, try basename match
        if (ignoreExtensions) {
            for (const item of items) {
                if (!item.isDirectory()) {
                    const basename = path.parse(item.name).name;
                    if (basename === itemName) {
                        return path.join(sourcePath, item.name);
                    }
                }
            }
        }

        return null;
    } catch (error) {
        throw new Error(`Failed to search in source directory: ${error.message}`);
    }
}

async function copyDirectory(src, dest) {
    try {
        await fs.mkdir(dest, { recursive: true });
        const items = await fs.readdir(src, { withFileTypes: true });

        for (const item of items) {
            const srcPath = path.join(src, item.name);
            const destPath = path.join(dest, item.name);

            if (item.isDirectory()) {
                await copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    } catch (error) {
        throw new Error(`Failed to copy directory: ${error.message}`);
    }
}
