import Aurora from "../aurora/auroraCore";
import AuroraBatcher from "../aurora/urp/batcher";
export const addInputEvents = () => {
  window.addEventListener("keypress", (e) => {
    switch (e.key) {
      case "l":
        AuroraBatcher.setLights(
          AuroraBatcher.getRenderData.lighting ? false : true
        );
        break;
      case "k":
        AuroraBatcher.setBloom(
          AuroraBatcher.getRenderData.bloom.active ? false : true
        );
        break;
      case "z":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("grayscale", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "x":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("chromaticAbber", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "c":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("invert", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "v":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("noice", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "b":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("sepia", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "n":
        AuroraBatcher.getRenderData.screenShader.type === "none"
          ? AuroraBatcher.setScreenShader("vignette", 1)
          : AuroraBatcher.setScreenShader("none");
        break;
      case "r":
        Aurora.resizeCanvas({
          width: window.innerWidth,
          height: window.innerHeight,
        });
        break;
    }
  });
};
