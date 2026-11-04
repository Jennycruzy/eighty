import assert from "node:assert/strict";
import test from "node:test";

import {
  boxFromDrag,
  clampBox,
  MIN_BOX,
  moveBox,
  pixelRect,
  resizeBox,
} from "../../shared/cover-box.ts";

test("A drag in any direction gives the same box, kept on the photo", () => {
  const forward = boxFromDrag({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.4 });
  const backward = boxFromDrag({ x: 0.5, y: 0.4 }, { x: 0.1, y: 0.2 });
  assert.deepEqual(forward, backward);
  assert.deepEqual(boxFromDrag({ x: -0.2, y: 0.9 }, { x: 0.3, y: 1.4 }), {
    x: 0,
    y: 0.9,
    width: 0.3,
    height: 0.09999999999999998,
  });
});

test("Keyboard moves and resizes never leave the photo or vanish", () => {
  let box = clampBox({ x: 0.4, y: 0.4, width: 0.3, height: 0.1 });
  box = moveBox(box, 1, 1);
  assert.equal(box.x + box.width, 1);
  assert.equal(box.y + box.height, 1);
  box = resizeBox(box, -5, -5);
  assert.equal(box.width, MIN_BOX);
  assert.equal(box.height, MIN_BOX);
  box = moveBox(box, -3, -3);
  assert.deepEqual([box.x, box.y], [0, 0]);
});

test("Covered pixels round outward so no edge of a name shows", () => {
  assert.deepEqual(
    pixelRect({ x: 0.101, y: 0.2, width: 0.3, height: 0.0501 }, 1000, 800),
    { left: 101, top: 160, width: 300, height: 41 },
  );
  assert.deepEqual(
    pixelRect({ x: 0.999, y: 0.999, width: 0.5, height: 0.5 }, 10, 10),
    {
      left: 9,
      top: 9,
      width: 1,
      height: 1,
    },
  );
});
