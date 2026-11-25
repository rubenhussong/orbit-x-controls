import { PerspectiveCamera, Quaternion } from "three";
import { describe, expect, it } from "vitest";
import { OrbitXControls } from "../../js/controls/OrbitXControls";

const setup = () => {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 500 });
  const camera = new PerspectiveCamera();
  const controls = new OrbitXControls(camera, element, "orbit");
  controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
  controls.setPosition({ x: 0, y: 3, z: 10 });
  controls.update(1 / 60); // applies the setup, so that the tests start at rest
  const events: string[] = [];
  for (const type of ["change", "start", "end", "modechange", "rest"] as const) {
    controls.addEventListener(type, () => events.push(type));
  }
  return { element, camera, controls, events };
};

const run = (controls: OrbitXControls, frames = 120) => {
  for (let i = 0; i < frames; i++) controls.update(1 / 60);
};

const count = (events: string[], type: string) =>
  events.filter((e) => e === type).length;

describe("events", () => {
  it("dispatches start and end around a drag", () => {
    const { element, events } = setup();
    element.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: 250, clientY: 250 }));
    expect(events).toEqual(["start"]);
    element.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 250 }));
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(events).toEqual(["start", "end"]);
  });

  it("dispatches start and end for each wheel event", () => {
    const { element, events } = setup();
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    expect(events).toEqual(["start", "end"]);
  });

  it("keeps a drag running when scrolling in between", () => {
    const { element, camera, controls, events } = setup();
    element.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: 250, clientY: 250 }));
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    const quaternion = camera.quaternion.clone();
    element.dispatchEvent(new MouseEvent("mousemove", { clientX: 350, clientY: 250 }));
    run(controls);
    expect(camera.quaternion.angleTo(quaternion)).toBeGreaterThan(0.01); // still rotating
    expect(events.filter((e) => e === "start" || e === "end")).toEqual(["start"]);
  });

  it("dispatches no start for a disabled action", () => {
    const { element, controls, events } = setup();
    controls.rotateEnabled = false;
    element.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(events).toEqual([]);
  });

  it("dispatches change while moving and rest once at the end", () => {
    const { element, controls, events } = setup();
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    run(controls);
    expect(count(events, "change")).toBeGreaterThan(5);
    expect(count(events, "rest")).toBe(1);
    expect(events[events.length - 1]).toBe("rest");
  });

  it("dispatches nothing while at rest", () => {
    const { controls, events } = setup();
    run(controls);
    expect(events).toEqual([]);
  });

  it("dispatches change immediately when a method jumps", () => {
    const { controls, events } = setup();
    controls.setPosition({ x: 5, y: 0, z: 5 });
    expect(events).toEqual(["change"]);
  });

  it("dispatches modechange with the new mode", () => {
    const { controls } = setup();
    const modes: string[] = [];
    controls.addEventListener("modechange", (e) => modes.push(e.mode));
    controls.setMode("isotropic");
    controls.mode = "grounded";
    controls.setMode("grounded"); // no change
    expect(modes).toEqual(["isotropic", "grounded"]);
  });

  it("does not show the target for a frame when a transition starts", () => {
    const { camera, controls } = setup();
    let last = camera.quaternion.clone();
    let maxStep = 0;
    controls.addEventListener("change", () => {
      maxStep = Math.max(maxStep, camera.quaternion.angleTo(last));
      last = camera.quaternion.clone();
    });
    controls.setMode("isotropic", { up: { x: 0, y: 0, z: 1 }, transition: true });
    run(controls);
    expect(maxStep).toBeLessThan(Math.PI / 6);
    expect(camera.quaternion.angleTo(new Quaternion())).toBeGreaterThan(0); // moved at all
  });
});
