import test from "node:test";
import assert from "node:assert/strict";
import { monthScale } from "./coverage-scale.ts";

test("inclusive coverage clips at month boundaries without inventing days", () => {
  const m = monthScale(2026, 8);
  assert.equal(m.covered(null), 0);
  assert.equal(m.covered("2026-08-31"), 0);
  assert.equal(m.covered("2026-09-01"), 100 / 30);
  assert.equal(m.covered("2026-09-30"), 100);
  assert.equal(m.covered("2026-10-12"), 100);
});
test("next cycle spans two months and preserves a one-day cycle", () => {
  const sept = monthScale(2026, 8),
    oct = monthScale(2026, 9);
  assert.deepEqual(sept.interval("2026-09-29", "2026-10-05"), {
    left: (28 / 30) * 100,
    width: (2 / 30) * 100,
  });
  assert.deepEqual(oct.interval("2026-09-29", "2026-10-05"), { left: 0, width: (5 / 31) * 100 });
  assert.deepEqual(sept.interval("2026-09-30", "2026-09-30"), {
    left: (29 / 30) * 100,
    width: (1 / 30) * 100,
  });
  assert.equal(sept.interval("2026-10-01", "2026-10-07"), null);
  assert.equal(sept.interval("2026-08-01", "2026-08-07"), null);
});
test("offscreen production markers are hidden instead of pinned to the last day", () => {
  const m = monthScale(2026, 8);
  assert.equal(m.marker("2026-10-08"), null);
  assert.equal(m.marker("2026-08-31"), null);
  assert.equal(m.marker(null), null);
  assert.equal(m.marker("2026-09-01"), (0.5 / 30) * 100);
  assert.equal(m.marker("2026-09-29"), (28.5 / 30) * 100);
});
test("calendar scale handles leap February and year transitions", () => {
  assert.equal(monthScale(2028, 1).days, 29);
  assert.equal(monthScale(2027, 1).days, 28);
  assert.deepEqual(monthScale(2027, 0).interval("2026-12-29", "2027-01-04"), {
    left: 0,
    width: (4 / 31) * 100,
  });
});
