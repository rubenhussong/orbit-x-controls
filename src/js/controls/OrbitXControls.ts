import { PerspectiveCamera, Quaternion, Vector3, Vector3Like } from "three";
import { InteractionHandler } from "./InteractionHandler";
import { ControlMode } from "./types/ControlMode";
import { ModeSpecificSetting } from "./utils/ModeSpecificSetting";
import { ControlStateInterpolator } from "./ControlStateInterpolator";
import { IsotropicInterpolator } from "./interpolators/IsotropicInterpolator";
import { GroundedInterpolator } from "./interpolators/GroundedInterpolator";
import { OrbitInterpolator } from "./interpolators/OrbitInterpolator";
import { SaveState } from "./utils/SaveState";
import { SmoothDamper } from "./utils/SmoothDamper";
import { approxEqual } from "./utils/mathUtils";

/**
 * Custom camera controls with different modes that define the transformations triggered by user interaction.
 */
export class OrbitXControls extends InteractionHandler {
  private camera: PerspectiveCamera;
  private _mode: ControlMode;
  private controlStateHandler: ControlStateInterpolator<any>;

  private defaultState: SaveState;

  constructor(
    domElement: HTMLElement,
    camera: PerspectiveCamera,
    mode: ControlMode = "orbit"
  ) {
    super(domElement);
    this.camera = camera;
    this._mode = mode;
    this.controlStateHandler = this.getAnimatorFromMode(mode);
    this.defaultState = new SaveState();
    this.needsUpdate = true;
    this.enable();
  }

  // ==================== S E T T I N G S

  needsUpdate = false;
  dampingEnabled = true;
  minDollyStep = 5e-3;

  // Approx. time in seconds to reach the new state in methods called with transition (setMode, setPosition, loadState, ...).
  // About 2.4 times this value until the movement looks finished. User input uses smoothTime instead.
  transitionTime = 0.3;

  // If a transition triggered by a method call is running, see transitionTime.
  private transitionRunning = false;

  dollySpeed = new ModeSpecificSetting<number>({
    isotropic: 0.3,
    grounded: 0.1,
    orbit: 0.3,
  });
  rotateSpeed = new ModeSpecificSetting<number>({
    isotropic: 2,
    grounded: 0.5,
    orbit: 2,
  });
  panSpeed = new ModeSpecificSetting<number>({
    isotropic: 1,
    grounded: 0.1 * Math.PI,
    orbit: 1,
  });

  // Approx. time in seconds to reach end state in update function
  smoothTime = new ModeSpecificSetting<number>({
    isotropic: 0.1,
    grounded: 0.15,
    orbit: 0.1,
  });

  // afterChange method updates camera when distance limit is changed
  minDistance = new ModeSpecificSetting<number>({
    isotropic: 0,
    grounded: 0,
    orbit: 0,
    beforeChange: (v, mode) => {
      if (v < 0) throw new Error("Min distance must be positive.");
      if (v > this.maxDistance[mode])
        throw new Error("Min distance must not be larger than max distance.");
    },
    afterChange: (_, mode) => {
      if (this.mode !== mode) return;
      this.clampDistance();
      this.internalUpdate();
    },
  });
  maxDistance = new ModeSpecificSetting<number>({
    isotropic: Infinity,
    grounded: Infinity,
    orbit: Infinity,
    beforeChange: (v, mode) => {
      if (v < 0) throw new Error("Max distance must be positive.");
      if (v < this.minDistance[mode])
        throw new Error("Max distance must not be smaller than min distance.");
    },
    afterChange: (_, mode) => {
      if (this.mode !== mode) return;
      this.clampDistance();
      this.internalUpdate();
    },
  });

  // ==================== M O D E

  /**
   * @returns the active control mode
   */
  get mode(): ControlMode {
    return this._mode;
  }

  /**
   * Changes the mode without transition and with the default up direction. See setMode.
   * @param mode new control mode
   */
  set mode(mode: ControlMode) {
    this.setMode(mode);
  }

  /**
   * 'orbit' - Orbit around a center point, but blocked at the poles to prevent being upside down.
   * 'isotropic' - Like 'orbit', but without the pole locks. Instead, the camera “up” is continuously updated.
   * 'grounded' - Rotation and position are separated. Rotation around oneself instead of an orbit center. Panning is actually a slow rotation around the orbit center.
   * The camera position is maintained, the distance limits of the new mode are enforced.
   * @param mode new control mode
   * @param options.up direction that should be up afterwards: the pole axis in 'orbit', the screen up in 'isotropic'. Ignored in 'grounded', where up always points away from the orbit center.
   *   Defaults to the current camera up. If the camera looks along it (e.g. coming from 'grounded'), the former viewing direction along the surface becomes up.
   *   Can also be used without changing the mode.
   * @param options.transition if the camera should move to its new state in one smooth movement (or jump if false)
   * @param options.transitionTime smooth time of the transition in seconds (default: transitionTime)
   */
  setMode = (
    mode: ControlMode,
    {
      up,
      transition = false,
      transitionTime = this.transitionTime,
    }: { up?: Vector3Like; transition?: boolean; transitionTime?: number } = {}
  ) => {
    if (this.mode === mode && !up) return;
    // The new state is applied immediately. A transition blends the camera from its old to its new transformation.
    // This is one movement, also if the view direction changes, e.g. from 'grounded' to the orbit center.
    const from = this.blend ?? {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
    };
    const saveState = this.controlStateHandler.saveState();
    if (this.mode !== mode) {
      this._mode = mode;
      this.controlStateHandler = this.getAnimatorFromMode(mode);
      // Start from the current state instead of the camera, which does not contain the orbit center.
      this.controlStateHandler.loadState(saveState);
      this.controlStateHandler.jumpToEnd();
    }
    if (up && mode !== "grounded") saveState.up.copy(up).normalize();
    this.controlStateHandler.loadState(saveState);
    this.clampDistance();
    this.internalUpdate();
    if (transition && this.dampingEnabled) {
      this.blend = {
        position: from.position.clone(),
        quaternion: from.quaternion.clone(),
        progress: 0,
        smoothTime: transitionTime,
        velocity: { value: 0 },
      };
      this.applyBlend();
    } else this.blend = undefined;
  };

  // Camera transformation before a mode change and how far the camera has moved to the new one, see setMode.
  private blend?: {
    smoothTime: number;
    position: Vector3;
    quaternion: Quaternion;
    progress: number;
    velocity: { value: number };
  };

  // Moves the camera from the blend start towards the transformation the control state has applied.
  private applyBlend = () => {
    if (!this.blend) return;
    const { position, quaternion, progress } = this.blend;
    // Copies of the target, because lerpVectors and slerpQuaternions start by overwriting the camera values.
    const targetPosition = this.blendTargetPosition.copy(this.camera.position);
    const targetQuaternion = this.blendTargetQuaternion.copy(this.camera.quaternion);
    this.camera.position.lerpVectors(position, targetPosition, progress);
    this.camera.quaternion.slerpQuaternions(quaternion, targetQuaternion, progress);
  };
  private blendTargetPosition = new Vector3();
  private blendTargetQuaternion = new Quaternion();

  // Advances the blend. Returns if it needs another update.
  private updateBlend = (delta: number) => {
    if (!this.blend) return false;
    this.blend.progress = SmoothDamper.damp(
      this.blend.progress,
      1,
      this.blend.velocity,
      this.blend.smoothTime,
      Infinity,
      delta
    );
    if (approxEqual(this.blend.progress, 1)) {
      this.blend = undefined;
      return false;
    }
    this.applyBlend();
    return true;
  };

  private getAnimatorFromMode = (
    mode: ControlMode
  ): ControlStateInterpolator<any> => {
    if (mode === "isotropic") {
      return new IsotropicInterpolator(this.camera);
    }
    if (mode === "grounded") {
      return new GroundedInterpolator(this.camera);
    }
    return new OrbitInterpolator(this.camera);
  };

  // ==================== E N A B L E  &  D I S A B L E

  // If the camera was moved while disabled, the changes are applied to the controls.
  // This might lead to an update of the orbit center.
  protected onEnable = () => {
    this.controlStateHandler.setFromObject(this.camera);
    this.controlStateHandler.jumpToEnd();
  };

  // Stop smoothDamp and discard all future changes on disable.
  protected onDisable = () => this.controlStateHandler.discardEnd();

  // ==================== S E T T E R

  /**
   * Sets the controlled camera. This will not affect the orientation and position of the camera.
   * The orbit center is reset based on the offset of the last camera.
   * @param c the new camera
   */
  setCamera = (c: PerspectiveCamera) => {
    this.camera = c;
    this.controlStateHandler.setFromObject(this.camera);
  };

  /**
   * Changes the position of the current camera. The orbit center remains unchanged and the distance limits are maintained.
   * If the active mode does not handle the viewing direction separately from the orbit center, the camera is rotated.
   * @param to new camera position
   * @param transition if the camera should smooth damp to the new position (or jump if false)
   */
  setPosition = (to: Vector3Like, transition = false) => {
    this.controlStateHandler.setPosition(to);
    this.clampDistance();
    this.internalUpdate(transition);
  };

  /**
   * Changes the orbit center. The camera position remains unchanged and the distance limits are maintained.
   * If the active mode does not handle the viewing direction separately from the orbit center, the camera is rotated.
   * @param to new orbit center position
   * @param transition if the camera should smooth damp to its new orientation (or jump if false)
   */
  setOrbitCenter = (to: Vector3Like, transition = false) => {
    this.controlStateHandler.setOrbitCenter(to);
    this.clampDistance();
    this.internalUpdate(transition);
  };

  /**
   * Makes the camera look in the direction of a certain point in its object space.
   * If the active mode does not handle the viewing direction separately from the orbit center, the orbit center is reset.
   * The distance of the camera to the orbit center is maintained. This method does not set the target as orbit center.
   * @param target where the camera should look
   * @param transition if the camera should smooth damp to its new orientation (or jump if false)
   */
  lookAt = (target: Vector3Like, transition = false) => {
    this.controlStateHandler.lookAt(target);
    this.clampDistance();
    this.internalUpdate(transition);
  };

  // Enforces the distance limits.
  private clampDistance() {
    this.controlStateHandler.clampDistance(
      this.minDistance[this.mode],
      this.maxDistance[this.mode]
    );
  }

  // ========== S T A T E   H A N D L I N G

  /**
   * Saves a default state to which the controller can be reset later.
   * @param state the new default state (default: the current state)
   */
  setDefaultState = (
    state: SaveState = this.controlStateHandler.saveState()
  ) => {
    this.defaultState = state;
  };

  /**
   * Resets the current state to the saved default state. If no default state has been saved, this is the state the camera was in after it was first added to the controls.
   * Distance limits are maintained. If this is unwanted, reset the distance limits.
   * @param transition if the camera should smooth damp tow the default state (or jump if false)
   */
  resetStateToDefault = (transition = false) => {
    this.loadState(this.defaultState, transition);
  };

  /**
   * Resets the current state. Distance limits are maintained. If this is unwanted, reset the distance limits.
   * This does not change the mode. If the active mode does not support properties of the state, such as a different orbit center and viewing direction, this can lead to unexpected effects.
   * @param state new camera state
   * @param transition if the camera should smooth damp tow the default state (or jump if false)
   */
  loadState = (state: SaveState, transition = false) => {
    this.controlStateHandler.loadState(state);
    this.clampDistance();
    this.internalUpdate(transition);
  };

  // ==================== T R A N S F O R M

  // Triggered by user interaction, the camera is rotated according to the active mode.
  protected rotate = (deltaX: number, deltaY: number) => {
    const rotateScale = Math.PI * this.rotateSpeed[this.mode];
    this.controlStateHandler.rotateUp(deltaY * rotateScale);
    this.controlStateHandler.rotateLeft(-deltaX * rotateScale);
    this.transitionRunning = false; // User input is damped with smoothTime
    this.needsUpdate = true;
  };

  // Triggered by user interaction, the camera is dollied according to the active mode.
  // Each step changes the distance by 5 % at dollySpeed 1. Negative steps dolly in.
  protected dolly = (direction: number) => {
    this.controlStateHandler.dolly(
      Math.pow(1.05, direction * this.dollySpeed[this.mode]),
      this.minDollyStep,
      this.minDistance[this.mode],
      this.maxDistance[this.mode]
    );
    this.transitionRunning = false;
    this.needsUpdate = true;
  };

  // Triggered by user interaction, the camera is panned according to the active mode.
  protected pan = (deltaX: number, deltaY: number) => {
    const fov = this.camera.getEffectiveFOV();
    const panScale = this.panSpeed[this.mode];
    this.controlStateHandler.panUp(-deltaY * panScale, fov);
    this.controlStateHandler.panLeft(deltaX * panScale, fov);
    this.transitionRunning = false;
    this.needsUpdate = true;
  };

  // ==================== U P D A T E

  /**
   * Updates camera position and orientation. This should be called in the tick loop.
   * @param delta time difference in seconds since last update
   * @returns whether rerender is needed
   */
  update = (delta: number) => {
    if (!this.needsUpdate) return false;
    const smoothTime = this.transitionRunning
      ? this.transitionTime
      : this.smoothTime[this.mode];
    if (this.dampingEnabled) {
      this.needsUpdate = this.controlStateHandler.update(smoothTime, delta);
    } else {
      this.controlStateHandler.jumpToEnd();
      this.needsUpdate = false;
    }
    if (!this.needsUpdate) this.transitionRunning = false;
    this.controlStateHandler.applyToObject(this.camera);
    if (this.updateBlend(delta)) this.needsUpdate = true;
    return true;
  };

  /**
   * Adpots immediate changes to the camera and propagates via the update method that a rerender is needed.
   * This function is called when changes are made without user interaction.
   * @param transition if the camera should smooth damp tow the default state (or jump if false)
   */
  private internalUpdate = (transition = false) => {
    if (!transition) {
      this.controlStateHandler.jumpToEnd();
      // Makes it redundant to call update if rerendering is happening anyway, for example initially.
      this.controlStateHandler.applyToObject(this.camera);
    } else this.transitionRunning = true;
    this.needsUpdate = true;
  };
}
