// Border-box auto-grow: scrollHeight 48 with 1px borders becomes a 50px height.
import { expect, test } from "vitest";
import { applyTextareaHeight, autoGrowHeight, borderTotal, minRowsHeight } from "./profileRows";

test("border total prefers the laid-out box and falls back to computed borders", () => {
  expect(borderTotal(48, 46, 0, 0)).toBe(2);
  expect(borderTotal(0, 0, 1, 1)).toBe(2);
});

test("two rows stay tall enough for the line, padding, and border", () => {
  expect(minRowsHeight(2, 20, 4, 4, 2)).toBe(50);
  expect(autoGrowHeight(48, 2, 50)).toBe(50);
  expect(autoGrowHeight(20, 2, 50)).toBe(50);
});

test("auto-grow sets height from scrollHeight plus 1px borders", () => {
  const node = document.createElement("textarea");
  node.rows = 2;
  document.body.appendChild(node);
  const readStyle = window.getComputedStyle;
  Object.defineProperty(node, "scrollHeight", { configurable: true, get: () => 48 });
  Object.defineProperty(node, "offsetHeight", { configurable: true, get: () => 0 });
  Object.defineProperty(node, "clientHeight", { configurable: true, get: () => 0 });
  window.getComputedStyle = () => ({
    borderTopWidth: "1px",
    borderBottomWidth: "1px",
    paddingTop: "4px",
    paddingBottom: "4px",
    lineHeight: "20px",
  });

  try {
    applyTextareaHeight(node);
    expect(node.style.height).toBe("50px");
  } finally {
    window.getComputedStyle = readStyle;
    node.remove();
  }
});
