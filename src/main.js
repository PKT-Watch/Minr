const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, powerSaveBlocker, powerMonitor } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const Store = require('electron-store');
const nodeSchedule = require('node-schedule');
const { download } = require('electron-dl');
const { autoUpdater } = require("electron-updater")
const si = require('systeminformation');
Store.initRenderer();
const store = new Store();

const fixPath = require('fix-path');
fixPath(); // Fix the $PATH on macOS and Linux when run from a GUI app

const isDevEnv = !app.isPackaged;
const isMac = process.platform === 'darwin';
let powerSaveBlockerID_mining;
let powerSaveBlockerID_schedule;

if (isDevEnv) {
    try {
        require('electron-reloader')(module);
    } catch (error) {

    }
}

const ptyShell = os.platform() === 'win32' ? 'powershell.exe' : (os.platform() == 'linux' ? 'bash' : 'zsh');

let mainWindow;
let debugWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 990,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'splash.html'));

    if (isDevEnv) {
        try {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        } catch (error) {

        }
    }

    const ptyProcess = pty.spawn(ptyShell, [], {
        name: 'xterm-color',
        cols: 800, // Must be huge to avoid line-break issues on Windows
        cwd: process.env.HOME,
        env: process.env
    });

    ptyProcess.on('data', data => {
        mainWindow.webContents.send('terminal.receiveData', data)
    });

    ipcMain.on('terminal.sendCommand', (event, data) => {
        ptyProcess.write(data);
    });

    ipcMain.on('terminal.interrupt', (event, data) => {
        ptyProcess.write('\x03');
    });

    ipcMain.on('get-userdata-path', (event, data) => {
        event.returnValue = app.getPath('userData');
    });

    const menuTemplate = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' },
                            { role: 'stopSpeaking' }
                        ]
                    }
                ] : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    broadcastSystemInfo();
};

function createDebugWindow() {
    debugWindow = new BrowserWindow({
        width: 500,
        height: 980,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    debugWindow.on('closed', () => {
        debugWindow = null;
    });
    debugWindow.loadURL(`file://${__dirname}/debug.html#v${app.getVersion()}`);
    return debugWindow;
}

function broadcastSystemInfo() {
    si.currentLoad()
        .then(loadData => {
            si.cpuTemperature()
                .then(tempData => {
                    mainWindow.webContents.send('cpu', { usage: loadData.currentLoad, temp: tempData.main });

                    setTimeout(() => {
                        broadcastSystemInfo();
                    }, 2500);
                })
        })
}

ipcMain.on('get-cpu-data', () => {
    si.cpu()
        .then(cpuData => {
            mainWindow.webContents.send("cpu-data", cpuData)
        })
        .catch(error => console.error(error));
});

ipcMain.on('select-directory-triggered', () => {
    dialog.showOpenDialog({ properties: ['openFile'] })
        .then(({ filePaths }) => {
            mainWindow.webContents.send('directory-selected', filePaths);
        });
});

ipcMain.on('download-packetcrypt-release', async (event, info) => {
    const win = BrowserWindow.getFocusedWindow();
    download(win, info.url, info.properties)
        .then(dl => {
            const savePath = dl.getSavePath();
            if (os.platform() === 'win32') {
                //
            } else if (os.platform() === 'linux') {
                // Make file executable on Linux
                fs.chmod(savePath, 0o755, (error) => {
                    //
                });
            } else if (os.platform() === 'darwin') {
                fs.chmod(savePath, 0o755, (error) => {
                    //
                });
            }

            mainWindow.webContents.send("download-packetcrypt-complete", savePath)
        });
});

ipcMain.on('get-app-version', () => {
    mainWindow.webContents.send('app-version', app.getVersion());
});

ipcMain.on('color-mode', (event, colorMode) => {
    nativeTheme.themeSource = colorMode;
});

ipcMain.on('prevent-app-suspension', (event, reason) => {
    if (reason === 'mining') {
        powerSaveBlockerID_mining = powerSaveBlocker.start('prevent-app-suspension');
    } else if (reason === 'schedule') {
        powerSaveBlockerID_schedule = powerSaveBlocker.start('prevent-app-suspension');
    }
});

ipcMain.on('enable-app-suspension', (event, reason) => {
    if (reason === 'mining') {
        if (powerSaveBlockerID_mining) powerSaveBlocker.stop(powerSaveBlockerID_mining);
    } else if (reason === 'schedule') {
        if (powerSaveBlockerID_schedule) powerSaveBlocker.stop(powerSaveBlockerID_schedule);
    } 
});

ipcMain.on('scheduler-initialise', (event, data) => {
    createSchedule(event);
});

ipcMain.on('scheduler-destroy', (event, data) => {
    destroySchedule(event);
});

ipcMain.on('open-external-link', (event, url) => {
    shell.openExternal(url);
    return { action: 'deny' }
});

function createSchedule(event) {
    nodeSchedule.gracefulShutdown().then(() => {

        if (store.get('schedule_use', true)) {
            let schedule = store.get('schedule', []);

            for (let i = 0; i < schedule.length; i++) {
                let day = i+1;

                schedule[i].forEach(task => {
                    let hour = parseInt(task.time.split(':')[0]);
                    let mins = parseInt(task.time.split(':')[1]);

                    const taskData = {
                        taskId: task.id,
                        task: task.name,
                        taskTime: task.time,
                        configName: task.configName,
                        configId: task.configId,
                        disabled: task.disabled
                    }

                    nodeSchedule.scheduleJob(`${mins} ${hour} * * ${day}`, function() {
                        mainWindow.webContents.send('scheduled-task', taskData);
                    });
                    
                }); 
            }
        }

        if (event) {
            event.sender.send('scheduler-initialise', 'Schedule created');
        }
        
    });
}

function destroySchedule(event) {
    nodeSchedule.gracefulShutdown().then(() => {
        console.log('Schedule destroyed');

        if (event) {
            event.sender.send('scheduler-destroy', 'Schedule destroyed');
        }
    });
}

powerMonitor.on('resume', () => {
    sendStatusToWindow(`Computer awake: create schedule at ${new Date()}`)
    createSchedule();
});

powerMonitor.on('suspend', () => {
    sendStatusToWindow(`Computer suspending: destroy schedule at ${new Date()}`)
    destroySchedule();
});

ipcMain.on('dialog-message', (event, options) => {
    dialog.showMessageBox(mainWindow, {
        message: options.message,
        buttons: options.buttons
    }).then(res => {
        event.sender.send('dialog-message', res);
    });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow();

    if (isDevEnv) {
        createDebugWindow();
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    // if (process.platform !== 'darwin') {
    //   app.quit();
    // }

    app.quit();
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function sendStatusToWindow(text) {
    if (isDevEnv) {
        debugWindow.webContents.send('message', text);
    }
};

ipcMain.on('check-for-update', () => {
    checkForUpdate();
});

ipcMain.on('update-app', () => {
    autoUpdater.quitAndInstall();
});

function checkForUpdate() {
    autoUpdater.checkForUpdates();
};

autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
});
autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.');
});
autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available. ' + JSON.stringify(info));
});
autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
});
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);

});
autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded');
    mainWindow.webContents.send('app-update-notification', { message: 'An update is ready to install. Click here to relaunch.', options: { labels: { success: "Update available" }, durations: { global: 0 } } });
});