import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { expect, describe, it } from "vitest";
import { OrbitXControls } from "../../js/controls/OrbitXControls";
import { ControlMode } from "../../js/controls/types/ControlMode";

const mockDomElement = document.createElement("div");

describe("isotropic setPosition", async () => {
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(mockDomElement, camera, "isotropic");

  it("should set to position", async () => {
    const position = { x: 5, y: -10, z: 20 };
    controls.setPosition(position);
    expect(camera.position.x).toBeCloseTo(position.x);
    expect(camera.position.y).toBeCloseTo(position.y);
    expect(camera.position.z).toBeCloseTo(position.z);
  });

  it("should rotate to look at orbit center", async () => {
    controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
    const position = { x: 0, y: 0, z: -10 };
    controls.setPosition(position);
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.y).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(1);
  });
});

describe("isotropic enable", async () => {
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(mockDomElement, camera, "isotropic");
  controls.disable();

  it("should not change camera transformation", async () => {
    const quat = new Quaternion(0, 1, 2, 3).normalize();
    const pos = new Vector3(1, 2, 3);
    camera.quaternion.copy(quat);
    camera.position.copy(pos);
    controls.enable();
    // Run one frame so a mismatch between now and end state would move the camera.
    controls.needsUpdate = true;
    controls.update(1 / 60);
    expect(camera.position.x).toBeCloseTo(pos.x);
    expect(camera.position.y).toBeCloseTo(pos.y);
    expect(camera.position.z).toBeCloseTo(pos.z);
    // q and -q describe the same rotation, so compare the angle between them.
    expect(camera.quaternion.angleTo(quat)).toBeCloseTo(0);
  });
});

describe("mode switch", async () => {
  it("should change the mode", async () => {
    const controls = new OrbitXControls(
      mockDomElement,
      new PerspectiveCamera(),
      "orbit"
    );
    controls.mode = "isotropic";
    expect(controls.mode).toBe("isotropic");
    controls.mode = "grounded";
    expect(controls.mode).toBe("grounded");
  });

  const modes: ControlMode[] = ["orbit", "isotropic", "grounded"];
  for (const from of modes) {
    for (const to of modes) {
      if (from === to) continue;
      it(`should keep the camera position from ${from} to ${to}`, async () => {
        const camera = new PerspectiveCamera();
        const controls = new OrbitXControls(mockDomElement, camera, from);
        controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
        controls.setPosition({ x: 3, y: 4, z: 5 });
        const pos = camera.position.clone();
        controls.mode = to;
        for (let i = 0; i < 60; i++) {
          controls.needsUpdate = true;
          controls.update(1 / 60);
        }
        expect(camera.position.distanceTo(pos)).toBeCloseTo(0);
      });
    }
  }
});

describe("setMode", async () => {
  const forwardOf = (c: PerspectiveCamera) =>
    new Vector3(0, 0, -1).applyQuaternion(c.quaternion);
  const screenUpOf = (c: PerspectiveCamera) =>
    new Vector3(0, 1, 0).applyQuaternion(c.quaternion);
  const settle = (controls: OrbitXControls, seconds = 2) => {
    for (let i = 0; i < seconds * 60; i++) {
      controls.needsUpdate = true;
      controls.update(1 / 60);
    }
  };
  const setup = (mode: ControlMode) => {
    const camera = new PerspectiveCamera();
    const controls = new OrbitXControls(mockDomElement, camera, mode);
    controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
    controls.setPosition({ x: 3, y: 4, z: 5 });
    return { camera, controls };
  };

  it("should keep the view from isotropic to orbit", async () => {
    const { camera, controls } = setup("isotropic");
    controls.setMode("isotropic", { up: { x: 1, y: 1, z: 0 } }); // tilt the camera
    settle(controls);
    const forward = forwardOf(camera);
    const screenUp = screenUpOf(camera);
    controls.setMode("orbit");
    settle(controls);
    expect(forwardOf(camera).angleTo(forward)).toBeCloseTo(0);
    expect(screenUpOf(camera).angleTo(screenUp)).toBeCloseTo(0);
  });

  for (const to of ["orbit", "isotropic"] as ControlMode[]) {
    it(`should turn former forward into screen up from grounded to ${to}`, async () => {
      const { camera, controls } = setup("grounded");
      const position = camera.position.clone();
      const toCenter = position.clone().negate().normalize();
      const forward = forwardOf(camera);
      const expectedUp = forward
        .clone()
        .addScaledVector(toCenter, -forward.dot(toCenter))
        .normalize();
      controls.setMode(to);
      settle(controls);
      expect(camera.position.distanceTo(position)).toBeCloseTo(0);
      expect(forwardOf(camera).angleTo(toCenter)).toBeCloseTo(0);
      expect(screenUpOf(camera).angleTo(expectedUp)).toBeCloseTo(0);
    });
  }

  it("should use the given up as pole axis in orbit", async () => {
    const { camera, controls } = setup("isotropic");
    const position = camera.position.clone();
    controls.setMode("orbit", { up: { x: 0, y: 0, z: 2 } });
    settle(controls);
    expect(camera.position.distanceTo(position)).toBeCloseTo(0);
    expect(camera.up.angleTo(new Vector3(0, 0, 1))).toBeCloseTo(0);
  });

  it("should apply the given up without changing the mode", async () => {
    const { camera, controls } = setup("orbit");
    controls.setMode("orbit", { up: { x: 1, y: 0, z: 0 } });
    settle(controls);
    expect(controls.mode).toBe("orbit");
    expect(camera.up.angleTo(new Vector3(1, 0, 0))).toBeCloseTo(0);
  });

  it("should roll the given up to the screen top in isotropic", async () => {
    const { camera, controls } = setup("orbit");
    const position = camera.position.clone();
    const up = new Vector3(0, 0, 1);
    controls.setMode("isotropic", { up });
    settle(controls);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    expect(camera.position.distanceTo(position)).toBeCloseTo(0);
    expect(right.dot(up)).toBeCloseTo(0);
    expect(screenUpOf(camera).dot(up)).toBeGreaterThan(0);
  });

  it("should ignore the given up in grounded", async () => {
    const { camera, controls } = setup("orbit");
    const position = camera.position.clone();
    controls.setMode("grounded", { up: { x: 1, y: 0, z: 0 } });
    settle(controls);
    expect(controls.mode).toBe("grounded");
    expect(camera.position.distanceTo(position)).toBeCloseTo(0);
  });

  it("should enforce the distance limits of the new mode", async () => {
    const { camera, controls } = setup("orbit");
    controls.maxDistance.grounded = 5;
    controls.setMode("grounded");
    settle(controls);
    expect(camera.position.length()).toBeCloseTo(5);
  });

  it("should jump by default", async () => {
    const { camera, controls } = setup("isotropic");
    controls.setMode("orbit", { up: { x: 0, y: 0, z: 1 } });
    expect(camera.up.angleTo(new Vector3(0, 0, 1))).toBeCloseTo(0);
  });

  it("should smooth damp with transition", async () => {
    const { camera, controls } = setup("isotropic");
    const target = new Vector3(0, 0, 1);
    controls.setMode("orbit", { up: target, transition: true });
    controls.update(1 / 60);
    expect(camera.up.angleTo(target)).toBeGreaterThan(0.01);
    settle(controls);
    expect(camera.up.angleTo(target)).toBeCloseTo(0);
  });
});

describe("update", async () => {
  const modes: ControlMode[] = ["orbit", "isotropic", "grounded"];
  for (const from of modes) {
    for (const to of modes) {
      it(`should come to rest after a transition from ${from} to ${to}`, async () => {
        const camera = new PerspectiveCamera();
        const controls = new OrbitXControls(mockDomElement, camera, from);
        controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
        controls.setPosition({ x: 3, y: 4, z: 5 });
        controls.setMode(to, { up: { x: 0, y: 0, z: 1 }, transition: true });
        let frames = 0;
        while (controls.update(1 / 60) && frames < 600) frames++;
        expect(frames).toBeLessThan(600); // at rest within 10 seconds
      });
    }
  }
});

describe("transition path", async () => {
  const cases: [ControlMode, ControlMode][] = [
    ["isotropic", "orbit"],
    ["orbit", "orbit"],
    ["orbit", "isotropic"],
    ["isotropic", "isotropic"],
  ];
  for (const [from, to] of cases) {
    for (const up of [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: -1, z: 0 }, // antiparallel to the default up
    ]) {
      it(`should keep the position and rotate smoothly from ${from} to ${to} with up ${up.x},${up.y},${up.z}`, async () => {
        const camera = new PerspectiveCamera();
        const controls = new OrbitXControls(mockDomElement, camera, from);
        controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
        controls.setPosition({ x: 3, y: 4, z: 5 });
        const position = camera.position.clone();
        controls.setMode(to, { up, transition: true });
        let maxDeviation = 0;
        let maxStep = 0;
        let last = camera.quaternion.clone();
        for (let i = 0; i < 120; i++) {
          controls.update(1 / 60);
          maxDeviation = Math.max(maxDeviation, camera.position.distanceTo(position));
          maxStep = Math.max(maxStep, camera.quaternion.angleTo(last));
          last = camera.quaternion.clone();
        }
        expect(maxDeviation).toBeCloseTo(0);
        expect(maxStep).toBeLessThan(Math.PI / 4); // no sudden flip
      });
    }
  }
});
