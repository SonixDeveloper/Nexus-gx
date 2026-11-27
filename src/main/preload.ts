import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { BrowserAPI, Snapshot } from '../shared/model'

const api: BrowserAPI = {
  state: () => ipcRenderer.invoke('nexus:state'),
  command: command => ipcRenderer.invoke('nexus:command', command),
  metrics: () => ipcRenderer.invoke('nexus:metrics'),
  checkUpdates: () => ipcRenderer.invoke('nexus:check-updates'),
  wallpaper: () => ipcRenderer.invoke('nexus:wallpaper'),
  focus: callback => {
    const listener = (_: IpcRendererEvent, target: 'l' | 'f') => callback(target)
    ipcRenderer.on('nexus:focus', listener)
    return () => ipcRenderer.removeListener('nexus:focus', listener)
  },
  subscribe: callback => {
    const listener = (_: IpcRendererEvent, snapshot: Snapshot) => callback(snapshot)
    ipcRenderer.on('nexus:update', listener)
    return () => ipcRenderer.removeListener('nexus:update', listener)
  }
}
if (process.isMainFrame) contextBridge.exposeInMainWorld('nexus', api)
