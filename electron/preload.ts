import { ipcRenderer, contextBridge } from 'electron';
import { IProgress } from '../types/interfaces';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  selectFile: () => ipcRenderer.invoke('dialog:openFile'),
  downloadModpack: () => ipcRenderer.invoke('download:modpack'),
  // onGetProgress. Return the progress of the download to the renderer process
  onGetProgress: (callback: (progress: IProgress) => void) => {
    ipcRenderer.on('download:progress', (_, progress: IProgress) => {
      console.log('download:progress', progress);
      callback(progress);
    });
  },
  onComplete: (callback: (value: boolean) => void) => {
    ipcRenderer.on('download:complete', (_, value: boolean) => {
      console.log('download:complete', value);
      callback(value);
    });
  },

  cancelConversion: () => ipcRenderer.invoke('cancel:conversion'),
});
