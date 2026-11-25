import { Controls, EventDispatcher, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { OrbitXControls } from "../../js/controls/OrbitXControls";

const createDomElement = () => {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 500 });
  return element;
};

const settle = (controls: OrbitXControls) => {
  for (let i = 0; i < 120; i++) controls.update(1 / 60);
};

// Left drag, which rotates the camera in every mode
const drag = (element: HTMLElement) => {
  element.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: 250, clientY: 250 }));
  element.dispatchEvent(new MouseEvent("mousemove", { clientX: 350, clientY: 300 }));
  element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
};

// Returns if the camera reacts to a drag on the element
const reactsToInput = (controls: OrbitXControls, camera: PerspectiveCamera, element: HTMLElement) => {
  const quaternion = camera.quaternion.clone();
  drag(element);
  settle(controls);
  return camera.quaternion.angleTo(quaternion) > 0.01;
};

const setup = (connect = true) => {
  const element = createDomElement();
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(camera, connect ? element : null, "orbit");
  controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
  controls.setPosition({ x: 0, y: 0, z: 10 });
  return { element, camera, controls };
};

describe("three Controls", () => {
  it("is an instance of Controls and EventDispatcher", () => {
    const { controls, camera, element } = setup();
    expect(controls).toBeInstanceOf(Controls);
    expect(controls).toBeInstanceOf(EventDispatcher);
    expect(controls.object).toBe(camera);
    expect(controls.domElement).toBe(element);
  });

  it("is enabled and reacts to input after construction", () => {
    const { controls, camera, element } = setup();
    expect(controls.enabled).toBe(true);
    expect(reactsToInput(controls, camera, element)).toBe(true);
  });

  it("can be constructed without element and connected later", () => {
    const { controls, camera } = setup(false);
    expect(controls.domElement).toBe(null);
    const element = createDomElement();
    expect(reactsToInput(controls, camera, element)).toBe(false);
    controls.connect(element);
    expect(controls.domElement).toBe(element);
    expect(reactsToInput(controls, camera, element)).toBe(true);
  });

  it("moves the listeners when connecting to another element", () => {
    const { controls, camera, element } = setup();
    const other = createDomElement();
    controls.connect(other);
    expect(reactsToInput(controls, camera, element)).toBe(false);
    expect(reactsToInput(controls, camera, other)).toBe(true);
  });

  it("stops reacting after disconnect and reacts again after connect", () => {
    const { controls, camera, element } = setup();
    controls.disconnect();
    expect(reactsToInput(controls, camera, element)).toBe(false);
    controls.connect(element);
    expect(reactsToInput(controls, camera, element)).toBe(true);
  });

  it("stops reacting after dispose", () => {
    const { controls, camera, element } = setup();
    controls.dispose();
    expect(reactsToInput(controls, camera, element)).toBe(false);
  });
});

describe("enabled", () => {
  it("reflects enable and disable", () => {
    const { controls } = setup();
    controls.disable();
    expect(controls.enabled).toBe(false);
    controls.enable();
    expect(controls.enabled).toBe(true);
  });

  it("ignores input while set to false", () => {
    const { controls, camera, element } = setup();
    controls.enabled = false;
    expect(reactsToInput(controls, camera, element)).toBe(false);
    controls.enabled = true;
    expect(reactsToInput(controls, camera, element)).toBe(true);
  });

  it("takes over a camera moved while set to false without jumping", () => {
    const { controls, camera } = setup();
    controls.enabled = false;
    camera.position.set(4, 5, 6);
    camera.lookAt(0, 0, 0);
    const quaternion = camera.quaternion.clone();
    controls.enabled = true;
    controls.needsUpdate = true;
    settle(controls);
    expect(camera.position.distanceTo(new Vector3(4, 5, 6))).toBeCloseTo(0);
    expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
  });

  it("does not listen while disabled, even if connected", () => {
    const { controls, camera } = setup(false);
    controls.enabled = false;
    const element = createDomElement();
    controls.connect(element);
    expect(reactsToInput(controls, camera, element)).toBe(false);
    controls.enabled = true;
    expect(reactsToInput(controls, camera, element)).toBe(true);
  });
});
