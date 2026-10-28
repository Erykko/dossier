// Copying a tailored document from the preview (cover letter, resume, email)
// should give its text and nothing else. The parts' toolbars (Edit,
// Regenerate, Ask AI), "Rewriting…" and Copy buttons sit in the page next to
// the text, hidden with opacity so they can take focus, which leaves them in
// any selection. Elements marked with COPY_SKIP are left out of what's copied.

/** Put this attribute on app UI inside a document that must never be copied. */
export const COPY_SKIP = "data-copy-skip";

const globalForCopy = globalThis as unknown as { cleanCopyUsers?: number };

/** The selection's text and HTML without the marked elements, or null when it has none. */
export function cleanSelection(selection: Selection): { text: string; html: string } | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;
  const holder = document.createElement("div");
  // innerText needs layout, so the copy is rendered for a moment, out of sight.
  holder.style.cssText = "position:fixed;left:-99999px;top:0;white-space:pre-wrap;";
  for (let index = 0; index < selection.rangeCount; index += 1) {
    holder.append(selection.getRangeAt(index).cloneContents());
  }
  if (!holder.querySelector(`[${COPY_SKIP}]`)) return null;
  for (const skipped of holder.querySelectorAll(`[${COPY_SKIP}]`)) skipped.remove();
  document.body.append(holder);
  try {
    // innerText keeps the paragraph breaks; jsdom, in tests, only has textContent.
    const text = (holder.innerText ?? holder.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
    return { text, html: holder.innerHTML };
  } finally {
    holder.remove();
  }
}

function onCopy(event: ClipboardEvent): void {
  // A text box copies its own value, which has no toolbars in it.
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return;
  const selection = document.getSelection();
  const clean = selection && event.clipboardData ? cleanSelection(selection) : null;
  if (!clean) return;
  event.clipboardData!.setData("text/plain", clean.text);
  event.clipboardData!.setData("text/html", clean.html);
  event.preventDefault();
}

/** Starts cleaning copies on the page; returns how to stop. Shared by every caller. */
export function startCleanCopy(): () => void {
  globalForCopy.cleanCopyUsers = (globalForCopy.cleanCopyUsers ?? 0) + 1;
  if (globalForCopy.cleanCopyUsers === 1) document.addEventListener("copy", onCopy);
  return () => {
    globalForCopy.cleanCopyUsers = (globalForCopy.cleanCopyUsers ?? 1) - 1;
    if (globalForCopy.cleanCopyUsers === 0) document.removeEventListener("copy", onCopy);
  };
}
