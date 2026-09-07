type ClipboardWriter = { writeText(text: string): Promise<void> };

export async function copyText(text: string, clipboard?: ClipboardWriter, fallback?: (value: string) => boolean) {
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return "clipboard" as const;
    } catch {
      // Continue to the explicit fallback instead of swallowing the failure.
    }
  }
  if (fallback?.(text)) return "fallback" as const;
  throw new Error("COPY_FAILED");
}

export function legacyBrowserCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
