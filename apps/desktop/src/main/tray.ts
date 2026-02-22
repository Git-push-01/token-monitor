import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  // Create a simple tray icon (16x16 for macOS menu bar)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  tray.setTitle('TM'); // Shows text in macOS menu bar
  tray.setToolTip('Token Monitor');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Token Monitor',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quick Stats',
      enabled: false, // Will be populated by engine
    },
    { type: 'separator' },
    {
      label: 'Widget Mode',
      type: 'radio',
      checked: true,
      click: () => mainWindow.webContents.send('view:change', 'widget'),
    },
    {
      label: 'Grid Mode',
      type: 'radio',
      click: () => mainWindow.webContents.send('view:change', 'grid'),
    },
    {
      label: 'Command Center',
      type: 'radio',
      click: () => mainWindow.webContents.send('view:change', 'command-center'),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate', '/settings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Token Monitor',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function updateTrayTitle(text: string) {
  if (tray) {
    tray.setTitle(text);
  }
}
