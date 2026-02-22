import { app, BrowserWindow, ipcMain, nativeTheme, safeStorage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../services/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createTray } from './tray';
import { registerIpcHandlers } from './ipc';
import { startWebSocketServer } from '../services/websocket';
import { startProxyServer } from '../services/proxy';
import { startEngine } from '../services/engine';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#fafafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  // Initialize core services
  const db = initDatabase();
  const wsServer = startWebSocketServer();
  const proxyServer = startProxyServer();
  const engine = startEngine(db, wsServer);

  // Create window and tray
  const win = createWindow();
  createTray(win);
  registerIpcHandlers(db, engine);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
