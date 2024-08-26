import { BrowserWindow, dialog, ipcMain } from 'electron';
import { STORE } from './main';
import { handleModpackDownload } from './ts/ts';
import { IProgress } from 'types/interfaces';

export const handleIPC = (win: BrowserWindow) => {
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Modpack', extensions: ['zip'] }],
    });
    if (canceled) return null;
    STORE.set('chosenFile', filePaths[0]);
    return filePaths[0];
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    if (canceled) return null;
    STORE.set('chosenDirectory', filePaths[0]);
    return filePaths[0];
  });

  ipcMain.handle('download:modpack', async () => {
    console.log('Downloading modpack...');
    const zipFile = STORE.get('chosenFile') as string | undefined;
    const directory = STORE.get('chosenDirectory') as string | undefined;

    if (!zipFile || !directory) {
      console.error('No file or directory chosen');
      return;
    }

    handleModpackDownload(zipFile, directory);
  });

  ipcMain.on('set:download:progress', (progress) => {
    win.webContents.send('download:progress', progress);
  });

  ipcMain.on('set:download:complete', (value) => {
    STORE.set('isDownloading', false);
    win.webContents.send('download:complete', value);
  });

  ipcMain.handle('cancel:conversion', () => {
    console.log('Cancelling conversion...');
    STORE.reset();
    STORE.set('cancelConversion', true);
    win.webContents.send('cancel:conversion');
    win.webContents.send('download:complete', false);
    win.webContents.send('download:progress', {
      isDownloading: false,
      current: 0,
      total: 0,
    } as IProgress);
  });
};
