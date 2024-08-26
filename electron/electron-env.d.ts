/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

/* API */

// --------- Expose some API to the Renderer process ---------
// contextBridge.exposeInMainWorld('ipcRenderer', {
//   selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
//   selectFile: () => ipcRenderer.invoke('dialog:openFile'),
// });

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    selectFolder: () => Promise<string>;
    selectFile: () => Promise<string>;
    downloadModpack: () => Promise<void>;
    onGetProgress: (
      callback: (progress: import('../types/interfaces').IProgress) => void
    ) => void;
    onComplete: (callback: (value: boolean) => void) => void;
    cancelConversion: () => Promise<void>;
  };
}
