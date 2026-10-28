// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { COPY_SKIP, cleanSelection, startCleanCopy } from "./clean-copy";

function selectAll(root: HTMLElement): Selection {
  const selection = document.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(root);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function letter(): HTMLElement {
  const root = document.createElement("article");
  root.innerHTML = `
    <div data-unit="greeting"><p>Dear AUQ team,</p><div ${COPY_SKIP}><button>Edit</button><button>Regenerate</button><button>Ask AI</button></div></div>
    <div data-unit="p1"><p>A senior WordPress role is the work I enjoy most.</p><span ${COPY_SKIP}>Rewriting…</span></div>`;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("clean copy", () => {
  it("leaves the toolbars out of the copied text and HTML", () => {
    const clean = cleanSelection(selectAll(letter()))!;
    expect(clean.text).toContain("Dear AUQ team,");
    expect(clean.text).toContain("A senior WordPress role is the work I enjoy most.");
    for (const ui of ["Edit", "Regenerate", "Ask AI", "Rewriting"]) {
      expect(clean.text).not.toContain(ui);
      expect(clean.html).not.toContain(ui);
    }
    expect(clean.html).toContain("<p><p>Dear AUQ team,</p></p>");
  });

  it("leaves a selection without app UI to the browser", () => {
    const root = document.createElement("p");
    root.textContent = "Just text";
    document.body.append(root);
    expect(cleanSelection(selectAll(root))).toBeNull();
  });

  it("writes the clean text to the clipboard on copy", () => {
    const stop = startCleanCopy();
    selectAll(letter());
    const data = new Map<string, string>();
    const event = new Event("copy", { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: { setData: (type: string, value: string) => data.set(type, value) } });
    document.dispatchEvent(event);
    stop();
    expect(event.defaultPrevented).toBe(true);
    expect(data.get("text/plain")).not.toContain("Regenerate");
    expect(data.get("text/plain")).toContain("Dear AUQ team,");
  });
});
