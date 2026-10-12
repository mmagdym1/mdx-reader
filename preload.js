/* جسر آمن بين النافذة والنظام (contextIsolation مفعّل) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mdxNative', {
  ready:        () => ipcRenderer.invoke('ready'),
  openFile:     () => ipcRenderer.invoke('open-file'),
  readPath:     (p) => ipcRenderer.invoke('read-path', p),
  saveFile:     (p, c) => ipcRenderer.invoke('save-file', p, c),
  saveFileAs:   (name, c) => ipcRenderer.invoke('save-file-as', name, c),
  setDirty:     (v) => ipcRenderer.invoke('set-dirty', v),
  closeNow:     () => ipcRenderer.invoke('close-now'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  setTitle:     (name) => ipcRenderer.invoke('set-title', name),
  onOpenPath:   (cb) => ipcRenderer.on('open-path', (_e, data) => cb(data)),
  onMenu:       (cb) => ipcRenderer.on('menu', (_e, action) => cb(action))
});
