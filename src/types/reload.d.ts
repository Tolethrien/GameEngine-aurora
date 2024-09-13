import { API } from "../preload/preload";
declare global {
  interface Window {
    APi: typeof API;
  }
}
