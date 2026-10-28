// How many rows a compact face textarea needs so its text is not clipped.
// The cube column is narrow, so a 200-character statement wraps well before
// the old single row (or the bio's old two rows) can show it.
export const COMPACT_CHARS_PER_ROW = 24;
export const RELAXED_CHARS_PER_ROW = 48;
export const BIO_MIN_ROWS = 3;
export const STATEMENT_MIN_ROWS = 2;

export function rowsForContent(text, minRows, charsPerRow) {
  const source = String(text ?? "");
  let lines = 0;
  for (const part of source.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerRow));
  }
  if (lines === 0) lines = 1;
  return Math.max(minRows, lines);
}

function px(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// With border-box, scrollHeight includes padding but not the border. The laid-out
// border is offsetHeight - clientHeight; computed border widths cover jsdom and
// the first frame before those box sizes exist.
export function borderTotal(offsetHeight, clientHeight, borderTop, borderBottom) {
  const laidOut = offsetHeight - clientHeight;
  if (laidOut > 0) return laidOut;
  return Math.max(0, borderTop) + Math.max(0, borderBottom);
}

// The rows attribute is a content-box count. A 2-row field still needs its
// padding and border on top of line-height, or the box is a couple of pixels short.
export function minRowsHeight(rows, lineHeight, paddingTop, paddingBottom, border) {
  if (!(rows > 0) || !(lineHeight > 0)) return 0;
  return rows * lineHeight + Math.max(0, paddingTop) + Math.max(0, paddingBottom) + Math.max(0, border);
}

export function autoGrowHeight(scrollHeight, border, minHeight) {
  if (!(scrollHeight > 0)) return 0;
  const grown = scrollHeight + Math.max(0, border);
  const floor = minHeight > 0 ? minHeight : 0;
  return Math.max(grown, floor);
}

export function applyTextareaHeight(node) {
  node.style.height = "auto";
  const style = getComputedStyle(node);
  const border = borderTotal(
    node.offsetHeight,
    node.clientHeight,
    px(style.borderTopWidth),
    px(style.borderBottomWidth),
  );
  const minHeight = minRowsHeight(
    Number(node.getAttribute("rows")) || 0,
    px(style.lineHeight),
    px(style.paddingTop),
    px(style.paddingBottom),
    border,
  );
  const height = autoGrowHeight(node.scrollHeight, border, minHeight);
  if (height > 0) node.style.height = `${height}px`;
}
