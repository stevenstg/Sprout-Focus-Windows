import activeWindow from 'active-win';
import windowManagerPackage from 'node-window-manager';
import { createEmptyActiveContext, isProbablyBrowser } from '../shared/models.js';

const { windowManager } = windowManagerPackage;

export class WindowsService {
  captureSystemContext() {
    const current = activeWindow.sync();
    if (!current) {
      return createEmptyActiveContext();
    }

    const processName = current.owner?.name ?? '';
    const processPath = current.owner?.path ?? '';
    return {
      timestamp: new Date().toISOString(),
      source: 'windows',
      title: current.title ?? '',
      windowId: current.id ?? null,
      processId: current.owner?.processId ?? null,
      processName,
      processPath,
      isBrowser: isProbablyBrowser(processName) || isProbablyBrowser(processPath),
      browserName: isProbablyBrowser(processName) ? processName : '',
      url: '',
      domain: '',
      confidence: 0.55,
    };
  }

  minimizeWindow(windowId) {
    const win = this.#findWindow(windowId);
    if (!win) {
      return false;
    }

    try {
      win.minimize();
      return true;
    } catch {
      return false;
    }
  }

  restoreWindow(windowId) {
    const win = this.#findWindow(windowId);
    if (!win) {
      return false;
    }

    try {
      win.restore();
      win.bringToTop();
      return true;
    } catch {
      return false;
    }
  }

  #findWindow(windowId) {
    if (windowId == null) {
      return null;
    }

    return windowManager.getWindows().find((candidate) => candidate.id === windowId && candidate.isWindow());
  }
}

export default WindowsService;
