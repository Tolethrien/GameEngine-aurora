// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Vite
// plugin that tells the Electron app where to look for the Vite-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare module "*.png" {
  const value: string;
  export default value;
}
declare module "*.jpg" {
  const value: string;
  export default value;
}
declare module "*.json" {
  const value: string;
  export default value;
}
declare module "*.wgsl" {
  const value: string;
  export default value;
}
declare module "*?raw" {
  const content: string;
  export default content;
}
declare module "*.ttf" {
  const content: string;
  export default content;
}
