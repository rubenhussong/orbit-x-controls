import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitXControls } from "./controls/OrbitXControls";
import { ControlMode } from "./controls/types/ControlMode";
import { EPSILON } from "./controls/utils/mathUtils";

// ==================== D E M O   S T A T E
const UP_OPTIONS: { [key: string]: THREE.Vector3Like | undefined } = {
  camera: undefined,
  "world Y": { x: 0, y: 1, z: 0 },
  "world Z": { x: 0, y: 0, z: 1 },
};

const settings = {
  mode: "orbit" as ControlMode,
  up: "camera",
  transition: true,
  enabled: true,
};

const HELP: { [key in ControlMode]: string[] } = {
  orbit: [
    "Left drag: orbit around the center, stops at the poles",
    "Right drag: pan",
    "Wheel: dolly in and out",
  ],
  isotropic: [
    "Left drag: rotate around the center, no poles",
    "Right drag: pan",
    "Wheel: dolly in and out",
  ],
  grounded: [
    "Left drag: look around",
    "Right drag: walk over the surface",
    "Wheel: move along the view direction",
  ],
};

let modeSettingsFolder: GUI | undefined;

// Mode shown in the gui and help, see syncModeUi.
let shownMode: ControlMode | undefined;

// Shown in the debug folder of the gui. Rendered frames show that rendering only happens on change.
let renderedFrames = 0;
const debug = { frames: "0", events: "–", wheel: "–" };

// ==================== M A I N
const stats = createStats();
const renderer = createRenderer();

const camera = createPerspectiveCamera(0, 0, 10);
const controls = new OrbitXControls(camera, renderer.domElement, settings.mode);
setDistanceLimits();
controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
controls.setPosition({ x: 0, y: 4, z: 10 });
controls.setDefaultState();

const scene = new THREE.Scene();
addLights();
addSphere(3, "skyblue", 5);
addPoleAndEquator(3);
addAxisHelper(9);

const help = createHelp();
const gui = createGui();
syncModeUi();
startListeningToControls();
startListeningToKeyboard();
startMeasuringWheel();

startListeningOnResize(() => (controls.needsUpdate = true));
startAnimating();
render();

// ==================== R E N D E R E R
function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// ==================== S T A T S
function createStats(parent = document.body) {
  const stats = new Stats();
  parent.appendChild(stats.dom);
  return stats;
}

// ==================== C A M E R A
function createPerspectiveCamera(
  x = 0,
  y = 0,
  z = 0,
  fov = 50,
  near = EPSILON / 10,
  far = 1000
) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(x, y, z);
  return camera;
}

// ==================== C O N T R O L S
// Sliders need finite limits. Keeps the camera outside of the sphere.
function setDistanceLimits() {
  controls.maxDistance.orbit = 50;
  controls.minDistance.orbit = 3.5;
  controls.maxDistance.isotropic = 50;
  controls.minDistance.isotropic = 3.5;
  controls.maxDistance.grounded = 15;
  controls.minDistance.grounded = 6;
}

// The gui and help follow via the modechange event, see startListeningToControls.
function setMode(mode: ControlMode) {
  controls.setMode(mode, {
    up: UP_OPTIONS[settings.up],
    transition: settings.transition,
  });
}

// Rebuilds the mode specific gui and help, if the mode has changed.
function syncModeUi() {
  if (shownMode === controls.mode) return;
  shownMode = controls.mode;
  updateModeSettings();
  updateHelp();
}

function resetToStart() {
  controls.resetStateToDefault(settings.transition);
}

// ==================== L I G H T S
function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 3, 1000, 0.01);
  pointLight.position.set(100, 0, 0);
  scene.add(pointLight);
}

// ==================== A X I S   H E L P E R
function addAxisHelper(size = 5) {
  const axesHelper = new THREE.AxesHelper(size);
  scene.add(axesHelper);
}

// ==================== M E S H E S
function addSphere(
  radius: number,
  color: THREE.ColorRepresentation,
  detail = 30,
  x = 0,
  y = 0,
  z = 0
) {
  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, detail),
    new THREE.MeshLambertMaterial({ color: color, wireframe: true })
  );
  sphere.position.set(x, y, z);
  scene.add(sphere);
}

// Makes "up" visible: a cone at the north pole (+Y) and a ring at the equator.
function addPoleAndEquator(radius: number) {
  const pole = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.8, 16),
    new THREE.MeshBasicMaterial({ color: "tomato" })
  );
  pole.position.set(0, radius + 0.4, 0);
  scene.add(pole);
  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.03, 8, 96),
    new THREE.MeshBasicMaterial({ color: "gold" })
  );
  equator.rotation.x = Math.PI / 2;
  scene.add(equator);
}

// ==================== G U I
function createGui() {
  const gui = new GUI({ title: "Orbit X Controls" });

  const modeFolder = gui.addFolder("Mode");
  modeFolder
    .add(settings, "mode", ["orbit", "isotropic", "grounded"])
    .onChange((mode: ControlMode) => setMode(mode));
  modeFolder
    .add(settings, "up", Object.keys(UP_OPTIONS))
    .name("up (on mode change)");
  modeFolder.add(settings, "transition");
  modeFolder.add(controls, "transitionTime", 0, 2, 0.05).name("transition time (s)");
  modeFolder.add({ reset: resetToStart }, "reset").name("reset to start (R)");

  const inputFolder = gui.addFolder("Input");
  inputFolder.add(settings, "enabled").onChange((enabled: boolean) => {
    if (enabled) controls.enable();
    else controls.disable();
  });
  inputFolder.add(controls, "rotateEnabled").name("rotate");
  inputFolder.add(controls, "panEnabled").name("pan");
  inputFolder.add(controls, "dollyEnabled").name("dolly");
  inputFolder.add(controls, "dampingEnabled").name("damping");

  const wheelFolder = gui.addFolder("Wheel");
  wheelFolder.add(controls.wheel, "pixelsPerStep", 1, 50, 1).name("pixels per step");
  wheelFolder.add(controls.wheel, "minStepsAfterPause", 0, 20, 1).name("steps per notch");
  wheelFolder.add(controls.wheel, "maxStepsPerEvent", 1, 20, 1).name("max steps per event");
  wheelFolder.add(controls.wheel, "pause", 0, 500, 10).name("pause (ms)");
  wheelFolder.close();

  // Text fields, so the values can be copied
  const debugFolder = gui.addFolder("Debug");
  debugFolder.add(debug, "frames").name("frames rendered").listen();
  debugFolder.add(debug, "events").name("events").listen();
  debugFolder.add(debug, "wheel").name("last wheel gesture").listen();
  debugFolder.close();

  return gui;
}

// Shows the settings of the active mode. Rebuilt on mode change, as each mode has its own values.
function updateModeSettings() {
  modeSettingsFolder?.destroy();
  const mode = controls.mode;
  const folder = gui.addFolder(`Settings (${mode})`);
  folder.add(controls.rotateSpeed, mode, 0, 5, 0.05).name("rotate speed");
  folder.add(controls.panSpeed, mode, 0, 5, 0.05).name("pan speed");
  folder.add(controls.dollySpeed, mode, 0, 2, 0.05).name("dolly speed");
  folder.add(controls.smoothTime, mode, 0, 1, 0.01).name("smooth time (s)");
  addDistanceLimit(folder, controls.minDistance, "min distance");
  addDistanceLimit(folder, controls.maxDistance, "max distance");
  modeSettingsFolder = folder;
}
// Invalid limits (e.g. min > max) throw. The slider is reset in that case.
function addDistanceLimit(
  folder: GUI,
  setting: OrbitXControls["minDistance"],
  name: string
) {
  const mode = controls.mode;
  const proxy = { value: setting[mode] };
  const controller = folder.add(proxy, "value", 0, 60, 0.5).name(name);
  controller.onChange((value: number) => {
    try {
      setting[mode] = value;
    } catch {
      proxy.value = setting[mode];
      controller.updateDisplay();
    }
  });
}

// ==================== C O N T R O L S   E V E N T S
function startListeningToControls() {
  controls.addEventListener("change", render);
  controls.addEventListener("modechange", (e) => {
    settings.mode = e.mode;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    syncModeUi();
  });
  // Shows the latest events. Repeated events are counted instead of listed.
  const log: { label: string; count: number }[] = [];
  const add = (label: string) => {
    const last = log[log.length - 1];
    if (last?.label === label) last.count++;
    else log.push({ label, count: 1 });
    if (log.length > 6) log.shift();
    debug.events = log
      .map(({ label, count }) => (count > 1 ? `${label} ×${count}` : label))
      .join(" → ");
  };
  controls.addEventListener("change", () => add("change"));
  controls.addEventListener("start", () => add("start"));
  controls.addEventListener("end", () => add("end"));
  controls.addEventListener("modechange", (e) => add(`modechange (${e.mode})`));
  controls.addEventListener("rest", () => add("rest"));
}

// ==================== K E Y B O A R D
function startListeningToKeyboard() {
  const modes: { [key: string]: ControlMode } = {
    "1": "orbit",
    "2": "isotropic",
    "3": "grounded",
  };
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return; // typing in the gui
    if (e.key in modes) setMode(modes[e.key]);
    if (e.key === "r" || e.key === "R") resetToStart();
  });
}

// ==================== H E L P
function createHelp() {
  const element = document.getElementById("help")!;
  return {
    mode: element.querySelector<HTMLElement>("[data-mode]")!,
    list: element.querySelector<HTMLElement>("[data-input]")!,
  };
}

function updateHelp() {
  help.mode.textContent = controls.mode;
  help.list.replaceChildren(
    ...HELP[controls.mode].map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    })
  );
}
// ==================== W H E E L   M E A S U R E M E N T
// Shows what the browser reports for wheel events. Trackpads and mouse wheels differ a lot.
function startMeasuringWheel() {
  const UNITS = ["px", "lines", "pages"];
  let events = 0;
  let sum = 0;
  let max = 0;
  let unit = "px";
  let resetTimeout: number | undefined;
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      events++;
      sum += Math.abs(e.deltaY);
      max = Math.max(max, Math.abs(e.deltaY));
      unit = UNITS[e.deltaMode];
      debug.wheel = `${events} events, deltaY avg ${(sum / events).toFixed(1)} / max ${max.toFixed(1)} ${unit}`;
      // A new gesture starts after a short pause
      clearTimeout(resetTimeout);
      resetTimeout = window.setTimeout(() => {
        events = 0;
        sum = 0;
        max = 0;
      }, 500);
    },
    { passive: true }
  );
}

// ==================== R E S I Z E
function startListeningOnResize(handleResize: () => void) {
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    handleResize();
    render();
  }
  window.addEventListener("resize", onWindowResize, false);
}

// ==================== R E N D E R   L O O P
function startAnimating() {
  const timer = new THREE.Timer();
  timer.connect(document); // pauses while the tab is hidden

  function animate(timestamp?: number) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const delta = timer.getDelta();

    controls.update(delta); // renders via the change event
    stats.update();
  }
  animate();
}

function render() {
  renderer.render(scene, camera);
  renderedFrames++;
  debug.frames = String(renderedFrames);
}
