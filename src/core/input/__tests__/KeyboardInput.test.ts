// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { KeyboardInput } from "../KeyboardInput";

describe("KeyboardInput", () => {
  it("ArrowRight produces positive roll", () => {
    const input = new KeyboardInput();
    input.start();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }));
    const sticks = input.read(0.1);

    expect(sticks.roll).toBeGreaterThan(0);

    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));
    input.stop();
  });

  it("ArrowLeft produces negative roll", () => {
    const input = new KeyboardInput();
    input.start();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
    const sticks = input.read(0.1);

    expect(sticks.roll).toBeLessThan(0);

    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));
    input.stop();
  });
});
