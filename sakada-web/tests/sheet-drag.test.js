import { describe, it, expect } from "vitest";
import { rubberband, project, animateSpring, releaseVelocity } from "../js/sheet-drag.js";

/** A fake 60fps clock: raf queues one callback, tick() runs it 16ms later. */
function fakeClock() {
  let time = 0;
  let pending = null;
  return {
    opts: {
      raf: (cb) => ((pending = cb), 1),
      caf: () => (pending = null),
      now: () => time,
    },
    run(maxMs = 2000) {
      while (pending && time < maxMs) {
        time += 16;
        const cb = pending;
        pending = null;
        cb();
      }
      return time;
    },
  };
}

describe("rubberband", () => {
  it("doesn't move at zero and grows with the pull", () => {
    expect(rubberband(0, 500)).toBe(0);
    expect(rubberband(100, 500)).toBeGreaterThan(rubberband(50, 500));
    expect(rubberband(100, 500)).toBeLessThan(100);
  });
  it("never passes the sheet height, however far you pull", () => {
    expect(rubberband(1e6, 500)).toBeLessThan(500);
  });
});

describe("project", () => {
  it("projects nothing without speed", () => {
    expect(project(0)).toBe(0);
  });
  it("throws a 1000px/s flick about 99px", () => {
    expect(project(1000, 0.99)).toBeCloseTo(99, 5);
  });
});

describe("releaseVelocity", () => {
  it("measures px/s over the last 100ms", () => {
    const samples = [
      { y: 0, t: 0 },
      { y: 10, t: 150 },
      { y: 40, t: 200 },
      { y: 70, t: 250 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(600, 5);
  });
  it("is zero for a single sample", () => {
    expect(releaseVelocity([{ y: 5, t: 10 }])).toBe(0);
  });
});

describe("animateSpring", () => {
  it("settles at the target within a second without overshooting", () => {
    const clock = fakeClock();
    const frames = [];
    let done = false;
    animateSpring(300, 0, 0, (x) => frames.push(x), () => (done = true), clock.opts);
    const elapsed = clock.run();
    expect(done).toBe(true);
    expect(elapsed).toBeLessThan(1000);
    expect(frames.at(-1)).toBe(0);
    expect(Math.min(...frames)).toBeGreaterThanOrEqual(0);
  });
  it("starts moving in the direction of the release velocity", () => {
    const clock = fakeClock();
    const frames = [];
    animateSpring(100, 400, 2000, (x) => frames.push(x), null, clock.opts);
    clock.run();
    expect(frames[0]).toBeGreaterThan(100);
    expect(frames.at(-1)).toBe(400);
  });
  it("stops when cancelled", () => {
    const clock = fakeClock();
    let done = false;
    const cancel = animateSpring(0, 100, 0, () => {}, () => (done = true), clock.opts);
    cancel();
    clock.run();
    expect(done).toBe(false);
  });
});
