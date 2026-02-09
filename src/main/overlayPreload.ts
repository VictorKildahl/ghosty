import { contextBridge, ipcRenderer } from "electron";

const api = {
  getState: () => ipcRenderer.invoke("ghosting:get-state"),
  getSettings: () => ipcRenderer.invoke("ghosting:get-settings"),
  onState: (callback: (state: { phase: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { phase: string },
    ) => callback(state);
    ipcRenderer.on("overlay:state", listener);
    return () => ipcRenderer.removeListener("overlay:state", listener);
  },
  onSettings: (
    callback: (settings: {
      shortcut: {
        key: string;
        meta: boolean;
        shift: boolean;
        alt: boolean;
        ctrl: boolean;
      };
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: {
        shortcut: {
          key: string;
          meta: boolean;
          shift: boolean;
          alt: boolean;
          ctrl: boolean;
        };
      },
    ) => callback(settings);
    ipcRenderer.on("overlay:settings", listener);
    return () => ipcRenderer.removeListener("overlay:settings", listener);
  },
  setIgnoreMouse: (ignore: boolean) => {
    ipcRenderer.send("overlay:set-ignore-mouse", ignore);
  },
  stopGhosting: () => ipcRenderer.invoke("ghosting:stop"),
  cancelGhosting: () => ipcRenderer.invoke("ghosting:cancel"),
};

contextBridge.exposeInMainWorld("electronOverlay", api);
