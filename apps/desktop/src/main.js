const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data File...',
          accelerator: 'CmdOrCtrl+O',
          click: async (_, win) => {
            if (!win) return;
            const result = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              filters: [
                { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'sav', 'sas7bdat', 'dta'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            if (!result.canceled && result.filePaths.length) {
              win.webContents.send('file-opened', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Research Data Platform',
          click: async (_, win) => {
            if (!win) return;
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About',
              message: 'Research Data Platform',
              detail: `Version ${app.getVersion()}\nA comprehensive statistical analysis platform for researchers.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    ...(fs.existsSync(path.join(__dirname, '../assets/icon.png')) && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../web-dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle native file dialog for uploads
  const { ipcMain } = require('electron');
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'sav', 'sas7bdat', 'dta'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result;
  });

  ipcMain.handle('save-file-dialog', async (_, defaultName) => {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result;
  });
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
