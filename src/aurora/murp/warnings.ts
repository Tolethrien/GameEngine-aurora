export const WARNINGS = {
  TEXTURE_WARNING:
    "AuroraBatcher Error: Batcher required 'textureStore' to by set to true(default) in 'Aurora.initialize()' options and initial textureArray named 'userTextureAtlas' to work.\nMake sure that you are crating this textureArray before calling 'AuroraBatcher.createBatcher()'. \n\nTIP: if you dont have textures yet you can create emptyTextureArray as a placeholder, just remember to set you drawQuad with 'isTexture:0'.",
};
