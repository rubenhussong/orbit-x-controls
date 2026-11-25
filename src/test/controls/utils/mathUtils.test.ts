import { Quaternion } from "three";
import { expect, describe, it } from "vitest";
import { approxEqualQuat } from "../../../js/controls/utils/mathUtils";

describe("approxEqualQuat", async () => {
  const q = new Quaternion(1, 2, 3, 4).normalize();

  it("should be true for the same quaternion", async () => {
    expect(approxEqualQuat(q, q.clone())).toBe(true);
  });

  it("should be true for the negated quaternion (same rotation)", async () => {
    const negated = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    expect(approxEqualQuat(q, negated)).toBe(true);
  });

  it("should be false for a different rotation", async () => {
    const other = new Quaternion(4, 3, 2, 1).normalize();
    expect(approxEqualQuat(q, other)).toBe(false);
  });
});
