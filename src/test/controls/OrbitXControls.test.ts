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
