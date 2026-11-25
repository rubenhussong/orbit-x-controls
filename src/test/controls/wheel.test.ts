import { PerspectiveCamera } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitXControls } from "../../js/controls/OrbitXControls";

// Measured in Safari on a MacBook: trackpad gesture, slow mouse wheel notch and fast mouse wheel spin.

const setup = () => {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 500 });
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(element, camera, "orbit");
  controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
  controls.setPosition({ x: 0, y: 0, z: 10 });
  controls.dollySpeed.orbit = 1;
  return { element, camera, controls };
};

// Sends wheel events with a time between them and returns the resulting dolly steps.
const scroll = (
  deltas: number[],
  msBetween: number,
  configure: (c: OrbitXControls) => void = () => {}
) => {
  const { element, camera, controls } = setup();
  configure(controls);
  let time = 10000;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  for (const deltaY of deltas) {
    element.dispatchEvent(new WheelEvent("wheel", { deltaY }));
    time += msBetween;
  }
  for (let i = 0; i < 300; i++) controls.update(1 / 60);
  return Math.log(camera.position.length() / 10) / Math.log(1.05);
};

describe("wheel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts a trackpad stream by size", () => {
    // First event after a pause counts as a notch (5 steps), the other 32 events of 6px are one step each.
    const steps = scroll(new Array(33).fill(6), 16);
    expect(steps).toBeCloseTo(5 + 32);
  });

  it("gives slow mouse wheel notches a minimum of steps", () => {
    const steps = scroll([4, 4, 4], 500);
    expect(steps).toBeCloseTo(3 * 5);
  });

  it("limits the steps of a fast mouse wheel spin", () => {
    const steps = scroll(new Array(10).fill(215), 16);
    expect(steps).toBeCloseTo(10 * 5);
  });

  it("dollies in with negative deltas", () => {
    const steps = scroll([-4], 500);
    expect(steps).toBeCloseTo(-5);
  });

  it("converts lines to pixels", () => {
    const { element, camera, controls } = setup();
    vi.spyOn(performance, "now").mockReturnValue(10000);
    // 1 line = 16px = 2.67 steps, but after a pause at least 5
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, deltaMode: 1 }));
    vi.spyOn(performance, "now").mockReturnValue(10016);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, deltaMode: 1 }));
    for (let i = 0; i < 300; i++) controls.update(1 / 60);
    const steps = Math.log(camera.position.length() / 10) / Math.log(1.05);
    expect(steps).toBeCloseTo(5 + 16 / 6);
  });

  it("uses the wheel settings", () => {
    const slowNotches = scroll([4, 4, 4], 500, (c) => {
      c.wheel.minStepsAfterPause = 2;
    });
    expect(slowNotches).toBeCloseTo(3 * 2);
    const stream = scroll(new Array(11).fill(6), 16, (c) => {
      c.wheel.pixelsPerStep = 3;
      c.wheel.maxStepsPerEvent = 10;
      c.wheel.minStepsAfterPause = 0;
    });
    expect(stream).toBeCloseTo(11 * 2);
  });
});
