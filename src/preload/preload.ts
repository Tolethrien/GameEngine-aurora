import { contextBridge } from "electron";

export const API = {};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", API);
  } catch (error) {
    console.error(error);
  }
}
