# Orbit X Controls

Camera controls for [three.js](https://threejs.org) with three modes, smooth damping and smooth transitions between modes.
Originally written for a planetarium: look at the sun from all sides, orbit the earth with north up, land on it and walk over its surface.

## Features

- Three modes, switchable at runtime:
  - **orbit**: like OrbitControls. Orbits around a center, stops at the poles.
  - **isotropic**: like TrackballControls. Rotates freely around the center, no poles.
  - **grounded**: like standing on a planet. The center is fixed, panning walks over the surface and the view direction is independent of the center.
- Smooth damping for all movements, in object space
- Mode changes and camera moves from code can be animated as one smooth movement
- Settings per mode (speeds, damping, distance limits)
- Works like the controls that come with three.js: extends `Controls`, dispatches `change`, `start` and `end` events
- Consistent wheel zoom for trackpads and mouse wheels

## Status

Work in progress. The controls are tested, but not yet available as a package. To use them, copy `src/js/controls` into your project. It requires three.js 0.168 or newer.

Packaging (installation from GitHub by tag) and a check with React Three Fiber are planned.

## Demo

```sh
npm install
npm run dev
```

The demo has a panel to switch modes and try all settings. Keys: `1` orbit, `2` isotropic, `3` grounded, `R` reset.

## Usage

```ts
import * as THREE from "three";
import { OrbitXControls } from "./controls/OrbitXControls";

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

const controls = new OrbitXControls(camera, renderer.domElement, "orbit");
controls.setOrbitCenter({ x: 0, y: 0, z: 0 });
controls.setPosition({ x: 0, y: 4, z: 10 });

// Render only when the camera has moved
controls.addEventListener("change", () => renderer.render(scene, camera));

// update needs the time since the last frame in seconds
const timer = new THREE.Timer();
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  controls.update(timer.getDelta());
});
```

`update` also returns `true` if the camera has moved, so you can render based on the return value instead of the event.

## Input

|             | orbit                            | isotropic                         | grounded                         |
| ----------- | -------------------------------- | --------------------------------- | -------------------------------- |
| Left drag   | orbit around the center          | rotate around the center freely   | look around                      |
| Right drag  | pan                              | pan                               | walk over the surface            |
| Wheel       | dolly in and out                 | dolly in and out                  | move along the view direction    |

Touch: one finger rotates, two fingers dolly, three fingers pan.

## Changing modes

```ts
controls.mode = "isotropic"; // jumps

controls.setMode("orbit", {
  up: { x: 0, y: 0, z: 1 }, // optional
  transition: true, // move smoothly instead of jumping
  transitionTime: 0.5, // optional, defaults to controls.transitionTime
});
```

The camera keeps its position. `up` is the pole axis in orbit and the screen up in isotropic, it is ignored in grounded. Without `up`, the current camera up is kept, so the view does not change. Coming from grounded, where the camera does not have to look at the center, the former view direction becomes up.

With `transition`, turning to the center and rolling to the new up happen in one movement.

## Moving the camera from code

```ts
controls.setPosition({ x: 5, y: 0, z: 5 }, true); // true: transition
controls.setOrbitCenter({ x: 1, y: 0, z: 0 }, true);
controls.lookAt({ x: 0, y: 2, z: 0 }, true);

controls.setDefaultState(); // saves the current state
controls.resetStateToDefault(true);
```

Distance limits are enforced. Transitions take `controls.transitionTime` (default `0.3` seconds, the movement looks finished after about 2.4 times this value). User input interrupts them.

For your own animations, disable the controls, move the camera (including `camera.up`) and enable them again. The controls take over the camera without a jump.

## Events

```ts
controls.addEventListener("modechange", (e) => console.log(e.mode));
```

| Event        | When                                                     |
| ------------ | -------------------------------------------------------- |
| `change`     | the camera has moved                                     |
| `start`      | user interaction started                                 |
| `end`        | user interaction ended                                   |
| `modechange` | the mode has changed, with `mode`                        |
| `rest`       | the camera has come to rest after moving                 |

## Settings

Per mode, e.g. `controls.rotateSpeed.orbit = 1`:

| Setting       | orbit | isotropic | grounded  |
| ------------- | ----- | --------- | --------- |
| `rotateSpeed` | 2     | 2         | 0.5       |
| `panSpeed`    | 1     | 1         | 0.1 · π   |
| `dollySpeed`  | 0.3   | 0.3       | 0.1       |
| `smoothTime`  | 0.1   | 0.1       | 0.15      |
| `minDistance` | 0     | 0         | 0         |
| `maxDistance` | ∞     | ∞         | ∞         |

`smoothTime` is the approximate time in seconds to follow user input.

General:

| Setting                                         | Default | Description                                     |
| ----------------------------------------------- | ------- | ----------------------------------------------- |
| `enabled`                                       | `true`  | listen to user input, same as `enable()` / `disable()` |
| `rotateEnabled`, `panEnabled`, `dollyEnabled`   | `true`  | single actions                                  |
| `dampingEnabled`                                | `true`  | smooth movement, otherwise jump                 |
| `transitionTime`                                | `0.3`   | smooth time of transitions from code, seconds   |
| `wheel`                                         |         | conversion of wheel events into zoom steps, see below |

Wheel events differ a lot between devices: trackpads send many small events, mouse wheels a few events per notch. Each event counts by its size (`wheel.pixelsPerStep`, default 6), an event after a pause (`wheel.pause`, 100 ms) counts as a notch with at least `wheel.minStepsAfterPause` steps (5), and one event counts at most `wheel.maxStepsPerEvent` steps (5). Each step changes the distance by 5 % at `dollySpeed` 1.

## Lifecycle

```ts
const controls = new OrbitXControls(camera); // element can be connected later
controls.connect(renderer.domElement);
controls.disconnect();
controls.dispose(); // when not needed anymore
```

## Development

```sh
npm run dev       # demo
npm run test:run  # tests
npm run build     # type check and build the demo
```

## License

[MIT](LICENSE) © Ruben Hussong
