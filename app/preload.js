import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc.js';

function subscribe(channel, listener) {
  const wrapped = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('forestApi', {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.invoke.getState),
  refreshGuardianStatus: () => ipcRenderer.invoke(IPC_CHANNELS.invoke.refreshGuardianStatus),
  captureCurrentWindow: () => ipcRenderer.invoke(IPC_CHANNELS.invoke.captureCurrentWindow),
  getCurrentContext: () => ipcRenderer.invoke(IPC_CHANNELS.invoke.getCurrentContext),
  startSession: (payload) => ipcRenderer.invoke(IPC_CHANNELS.invoke.startSession, payload),
  endSession: (payload) => ipcRenderer.invoke(IPC_CHANNELS.invoke.endSession, payload),
  openMainWindow: () => ipcRenderer.invoke(IPC_CHANNELS.invoke.openMainWindow),
  subscribeState: (listener) => subscribe(IPC_CHANNELS.push.state, listener),
  subscribeViolation: (listener) => subscribe(IPC_CHANNELS.push.violation, listener),
  subscribeGuardianStatus: (listener) => subscribe(IPC_CHANNELS.push.guardianStatus, listener),
});
