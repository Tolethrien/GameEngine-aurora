import AuroraBatcher from "../aurora/urp/batcher";
import Aurora from "../aurora/auroraCore";
import char from "../assets/lamp1.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
import { addInputEvents } from "./inputs";
import { draw } from "./draw";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;

//Create Aurora Renderer Engine
const createAurora = async () => {
  await Aurora.initialize(canvas);

  //initialize renderStats Frame
  RenderFrame.Initialize();

  //create uniwersal render pipeline batcher
  await AuroraBatcher.createBatcher({
    backgroundColor: [0, 0, 0, 255],
    bloom: { active: true, str: 10 },
    lighting: true,
    maxLightsPerSceen: 200,
    loadTextures: [
      { name: "char", url: char },
      { name: "map", url: char },
    ],
  });

  // set global lighting to "dark"
  AuroraBatcher.setGlobalColorCorrection([0.02, 0.02, 0.02]);
  // AuroraBatcher.setScreenShader("chromaticAbber", 1);
  // AuroraBatcher.setLights(true);

  //add keaboard controls
  addInputEvents();

  //draw all the stuff
  draw();
};

//start!
createAurora();
