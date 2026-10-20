import { describe, it, expect } from "vitest";
import { swipeOutcome, COMPLETE_AT } from "../js/welcome-swipe.js";

describe("swipeOutcome", () => {
  const max = 250;

  it("completes once the knob passes the threshold", () => {
    expect(swipeOutcome(max * COMPLETE_AT, 0, max)).toBe("complete");
    expect(swipeOutcome(max, 0, max)).toBe("complete");
  });

  it("goes back when released short and slow", () => {
    expect(swipeOutcome(max * COMPLETE_AT - 1, 0, max)).toBe("back");
    expect(swipeOutcome(40, 0, max)).toBe("back");
  });

  it("a quick flick completes from a short distance", () => {
    expect(swipeOutcome(60, 1500, max)).toBe("complete");
  });

  it("flicking back home cancels even from far along", () => {
    expect(swipeOutcome(200, -2000, max)).toBe("back");
  });

  it("never completes with no track", () => {
    expect(swipeOutcome(10, 5000, 0)).toBe("back");
  });
});
