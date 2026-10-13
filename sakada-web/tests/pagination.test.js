import { describe, it, expect } from "vitest";
import { paginate, pageList } from "../js/pagination.js";

const make = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the first page of 60 items", () => {
    const state = paginate(make(60), 1);
    expect(state.rows).toHaveLength(25);
    expect(state.from).toBe(1);
    expect(state.to).toBe(25);
    expect(state.totalPages).toBe(3);
    expect(state.total).toBe(60);
    expect(state.page).toBe(1);
  });

  it("returns the last (partial) page of 212 items", () => {
    const state = paginate(make(212), 9);
    expect(state.rows).toHaveLength(12);
    expect(state.from).toBe(201);
    expect(state.to).toBe(212);
    expect(state.page).toBe(9);
    expect(state.totalPages).toBe(9);
  });

  it("clamps out-of-range and invalid pages", () => {
    const items = make(60);
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, NaN).page).toBe(1);
  });

  it("handles an empty list", () => {
    const state = paginate([], 1);
    expect(state.page).toBe(1);
    expect(state.totalPages).toBe(1);
    expect(state.from).toBe(0);
    expect(state.to).toBe(0);
    expect(state.rows).toEqual([]);
  });
});

describe("pageList", () => {
  it("shows every page when there are 7 or fewer", () => {
    expect(pageList(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses the middle on page 1 of 9", () => {
    expect(pageList(1, 9)).toEqual([1, 2, "…", 9]);
  });

  it("keeps neighbours around the current page", () => {
    expect(pageList(5, 9)).toEqual([1, "…", 4, 5, 6, "…", 9]);
  });

  it("collapses the middle on the last page of 9", () => {
    expect(pageList(9, 9)).toEqual([1, "…", 8, 9]);
  });
});
