import { PerspectiveCamera, Vector3 } from "three";
import { expect, describe, it } from "vitest";
import { OrbitXControls } from "../../js/controls/OrbitXControls";
import { ControlMode } from "../../js/controls/types/ControlMode";

// ==================== H E L P E R S

const createDomElement = () => {
  const element = document.createElement("div");
  // jsdom does not compute layouts, but pointer deltas are relative to the height.
  Object.defineProperty(element, "clientHeight", { value: 500 });
  return element;
};

const setup = (mode: ControlMode) => {
  const domElement = createDomElement();
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(camera, domElement, mode);
  controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
  controls.setPosition({ x: 0, y: 0, z: 10 });
  return { domElement, camera, controls };
};

const settle = (controls: OrbitXControls, seconds = 2) => {
  for (let i = 0; i < seconds * 60; i++) controls.update(1 / 60);
};

const forwardOf = (c: PerspectiveCamera) =>
  new Vector3(0, 0, -1).applyQuaternion(c.quaternion);
const screenUpOf = (c: PerspectiveCamera) =>
  new Vector3(0, 1, 0).applyQuaternion(c.quaternion);
const directionTo = (c: PerspectiveCamera, target: Vector3) =>
  target.clone().sub(c.position).normalize();

const MOUSE_LEFT = 0;
const MOUSE_RIGHT = 2;

const drag = (
  element: HTMLElement,
  button: number,
  dx: number,
  dy: number
) => {
  const start = { clientX: 250, clientY: 250 };
  element.dispatchEvent(new MouseEvent("mousedown", { button, ...start }));
  element.dispatchEvent(
    new MouseEvent("mousemove", {
      clientX: start.clientX + dx,
      clientY: start.clientY + dy,
    })
  );
  element.dispatchEvent(new MouseEvent("mouseup", { button }));
};

const wheel = (element: HTMLElement, deltaY: number, times = 5) => {
  for (let i = 0; i < times; i++) {
    element.dispatchEvent(new WheelEvent("wheel", { deltaY }));
  }
};

const center = new Vector3(0, 0, 0);

// ==================== A L L   M O D E S

const modes: ControlMode[] = ["orbit", "isotropic", "grounded"];

describe.each(modes)("%s", (mode) => {
  const looksAtCenter = mode !== "grounded";

  describe("setters", () => {
    it("setPosition moves the camera to the position", () => {
      const { camera, controls } = setup(mode);
      controls.setPosition({ x: 3, y: -4, z: 5 });
      expect(camera.position.distanceTo(new Vector3(3, -4, 5))).toBeCloseTo(0);
    });

    it("setPosition respects the distance limits", () => {
      const { camera, controls } = setup(mode);
      controls.maxDistance[mode] = 8;
      controls.setPosition({ x: 0, y: 0, z: 20 });
      expect(camera.position.length()).toBeCloseTo(8);
    });

    it("setOrbitCenter keeps the camera position", () => {
      const { camera, controls } = setup(mode);
      const position = camera.position.clone();
      const newCenter = new Vector3(2, 1, 0);
      controls.setOrbitCenter(newCenter);
      expect(camera.position.distanceTo(position)).toBeCloseTo(0);
      if (looksAtCenter) {
        const toCenter = directionTo(camera, newCenter);
        expect(forwardOf(camera).angleTo(toCenter)).toBeCloseTo(0);
      }
    });

    it("lookAt turns the camera to the target", () => {
      const { camera, controls } = setup(mode);
      const target = new Vector3(3, 2, 0);
      controls.lookAt(target);
      const toTarget = directionTo(camera, target);
      expect(forwardOf(camera).angleTo(toTarget)).toBeCloseTo(0);
    });

    it("resetStateToDefault returns to the default state", () => {
      const { camera, controls } = setup(mode);
      controls.setDefaultState();
      const position = camera.position.clone();
      const forward = forwardOf(camera);
      controls.setPosition({ x: 5, y: 5, z: 0 });
      controls.resetStateToDefault();
      expect(camera.position.distanceTo(position)).toBeCloseTo(0);
      expect(forwardOf(camera).angleTo(forward)).toBeCloseTo(0);
    });
  });

  describe("distance limits", () => {
    it("lowering maxDistance pulls the camera in", () => {
      const { camera, controls } = setup(mode);
      controls.maxDistance[mode] = 5;
      expect(camera.position.length()).toBeCloseTo(5);
    });

    it("raising minDistance pushes the camera out", () => {
      const { camera, controls } = setup(mode);
      controls.minDistance[mode] = 12;
      expect(camera.position.length()).toBeCloseTo(12);
    });

    it("rejects invalid limits", () => {
      const { controls } = setup(mode);
      expect(() => (controls.minDistance[mode] = -1)).toThrow();
      controls.maxDistance[mode] = 10;
      expect(() => (controls.minDistance[mode] = 11)).toThrow();
    });
  });

  describe("enable and disable", () => {
    it("takes over a camera moved while disabled without jumping", () => {
      const { camera, controls } = setup(mode);
      controls.disable();
      camera.position.set(4, 5, 6);
      camera.lookAt(center);
      const quaternion = camera.quaternion.clone();
      controls.enable();
      controls.needsUpdate = true;
      settle(controls);
      expect(camera.position.distanceTo(new Vector3(4, 5, 6))).toBeCloseTo(0);
      expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
    });

    it("ignores user input while disabled", () => {
      const { domElement, camera, controls } = setup(mode);
      controls.disable();
      const position = camera.position.clone();
      const quaternion = camera.quaternion.clone();
      drag(domElement, MOUSE_LEFT, 100, 50);
      drag(domElement, MOUSE_RIGHT, 100, 50);
      wheel(domElement, 100);
      settle(controls);
      expect(camera.position.distanceTo(position)).toBeCloseTo(0);
      expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
    });
  });

  describe("user input", () => {
    it("wheel down moves away from the orbit center, wheel up moves closer", () => {
      const { domElement, camera, controls } = setup(mode);
      const distance = camera.position.length();
      wheel(domElement, 100);
      settle(controls);
      const fartherDistance = camera.position.length();
      expect(fartherDistance).toBeGreaterThan(distance);
      wheel(domElement, -100, 10);
      settle(controls);
      expect(camera.position.length()).toBeLessThan(fartherDistance);
    });

    it("left drag rotates", () => {
      const { domElement, camera, controls } = setup(mode);
      const position = camera.position.clone();
      const forward = forwardOf(camera);
      drag(domElement, MOUSE_LEFT, 100, 50);
      settle(controls);
      if (looksAtCenter) {
        // Orbits around the center
        expect(camera.position.distanceTo(position)).toBeGreaterThan(0.1);
        expect(camera.position.length()).toBeCloseTo(position.length());
        const toCenter = directionTo(camera, center);
        expect(forwardOf(camera).angleTo(toCenter)).toBeCloseTo(0);
      } else {
        // Looks around in place
        expect(camera.position.distanceTo(position)).toBeCloseTo(0);
        expect(forwardOf(camera).angleTo(forward)).toBeGreaterThan(0.1);
      }
    });

    it("right drag pans", () => {
      const { domElement, camera, controls } = setup(mode);
      const position = camera.position.clone();
      const forward = forwardOf(camera);
      drag(domElement, MOUSE_RIGHT, 100, 50);
      settle(controls);
      expect(camera.position.distanceTo(position)).toBeGreaterThan(0.1);
      if (looksAtCenter) {
        // Shifts camera and orbit center, the view direction stays the same
        expect(forwardOf(camera).angleTo(forward)).toBeCloseTo(0);
      } else {
        // Moves over the surface, the distance to the center stays the same
        expect(camera.position.length()).toBeCloseTo(position.length());
      }
    });

    it("respects disabled rotate, pan and dolly", () => {
      const { domElement, camera, controls } = setup(mode);
      controls.rotateEnabled = false;
      controls.panEnabled = false;
      controls.dollyEnabled = false;
      const position = camera.position.clone();
      const quaternion = camera.quaternion.clone();
      drag(domElement, MOUSE_LEFT, 100, 50);
      drag(domElement, MOUSE_RIGHT, 100, 50);
      wheel(domElement, 100);
      settle(controls);
      expect(camera.position.distanceTo(position)).toBeCloseTo(0);
      expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
    });

    it("comes to rest after user input", () => {
      const { domElement, controls } = setup(mode);
      drag(domElement, MOUSE_LEFT, 100, 50);
      drag(domElement, MOUSE_RIGHT, 100, 50);
      wheel(domElement, 100);
      let frames = 0;
      while (controls.update(1 / 60) && frames < 600) frames++;
      expect(frames).toBeLessThan(600);
    });
  });
});

// ==================== M O D E   S P E C I F I C

describe("orbit specific", () => {
  it("stops at the pole instead of turning upside down", () => {
    const { domElement, camera, controls } = setup("orbit");
    drag(domElement, MOUSE_LEFT, 0, 400); // far more than 180°
    settle(controls);
    expect(screenUpOf(camera).y).toBeGreaterThan(0);
    expect(Math.abs(camera.position.y)).toBeLessThan(camera.position.length());
  });
});

describe("isotropic specific", () => {
  it("rotates over the pole", () => {
    const { domElement, camera, controls } = setup("isotropic");
    // 250px of 500px height at rotateSpeed 2 is a rotation by PI
    drag(domElement, MOUSE_LEFT, 0, 250);
    settle(controls);
    expect(camera.position.distanceTo(new Vector3(0, 0, -10))).toBeCloseTo(0);
    expect(screenUpOf(camera).y).toBeCloseTo(-1); // upside down
  });

  it("keeps the screen up when setting the position to the opposite side", () => {
    const { camera, controls } = setup("isotropic");
    const screenUp = screenUpOf(camera);
    controls.setPosition({ x: 0, y: 0, z: -10 });
    expect(screenUpOf(camera).angleTo(screenUp)).toBeCloseTo(0);
  });
});

describe("grounded specific", () => {
  it("keeps the view direction when setting the position", () => {
    const { camera, controls } = setup("grounded");
    controls.lookAt({ x: 3, y: 2, z: 0 });
    const forward = forwardOf(camera);
    controls.setPosition({ x: 0, y: 6, z: 8 });
    expect(forwardOf(camera).angleTo(forward)).toBeCloseTo(0);
  });

  it("keeps the view direction relative to the surface when panning", () => {
    const { domElement, camera, controls } = setup("grounded");
    const lookUpAngle = () =>
      forwardOf(camera).angleTo(camera.position.clone().normalize());
    const angle = lookUpAngle();
    drag(domElement, MOUSE_RIGHT, 100, 50);
    settle(controls);
    expect(lookUpAngle()).toBeCloseTo(angle);
  });
});
