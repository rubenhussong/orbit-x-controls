import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { OrbitXControls } from "./controls/OrbitXControls";
import { EPSILON } from "./controls/utils/mathUtils";

// ==================== M A I N
const stats = createStats();
const renderer = createRenderer();

const camera = createPerspectiveCamera(0, 0, 10);
const controls = new OrbitXControls(renderer.domElement, camera, "isotropic");
controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
controls.minDistance.grounded = 6;
controls.maxDistance.grounded = 15;

const scene = new THREE.Scene();
addLights();
addSphere(3, "skyblue", 5);
addAxisHelper(9);

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
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    const updated = controls.update(delta);

    if (updated) render();
    stats.update();
  }
  animate();
}

function render() {
  renderer.render(scene, camera);
}
