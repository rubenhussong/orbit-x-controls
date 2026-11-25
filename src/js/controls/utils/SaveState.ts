import { Vector3 } from "three";
import { AXIS, approxCollinear, approxZeroVec3 } from "./mathUtils";

/**
 * Bridge class for saving and tranlating between instances of different ControlState implementations.
 */
export class SaveState {
  orbitCenter = new Vector3();
  offset = new Vector3(0, 0, 1);
  forward = new Vector3(0, 0, -1);
  up = new Vector3(0, 1, 0);
}

/**
 * Finds an up direction for states that always look at the orbit center ('orbit' and 'isotropic').
 * Prefers the SaveState up vector. If it is collinear with the viewing direction (e.g. coming from 'grounded', where up is the normalized offset),
 * the former viewing direction along the surface becomes up, like looking down at the ground from where one was looking at the horizon.
 * Falls back to the world axes if this is ambiguous as well.
 * @param state the SaveState to be loaded
 * @returns normalized up direction that is not collinear with the viewing direction towards the orbit center
 */
export const getUpFacingOrbitCenter = (state: SaveState) => {
  const forward = approxZeroVec3(state.offset)
    ? state.forward.clone().normalize()
    : state.offset.clone().negate().normalize();
  const forwardAlongSurface = state.forward
    .clone()
    .addScaledVector(forward, -state.forward.dot(forward));
  return [state.up, forwardAlongSurface, AXIS.Y, AXIS.Z]
    .filter((v) => !approxZeroVec3(v))
    .map((v) => v.clone().normalize())
    .find((v) => !approxCollinear(forward, v))!; // Non-null assertion because AXIS.Z is orthogonal to AXIS.Y
};
