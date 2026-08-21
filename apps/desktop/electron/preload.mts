import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ahoyDesktop", {
  platform: process.platform,
  chooseMp3Files: () => ipcRenderer.invoke("ahoy:choose-mp3-files"),
  openDeck: () => ipcRenderer.invoke("ahoy:open-deck")
});
