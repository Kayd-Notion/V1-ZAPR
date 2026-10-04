"use client";

/**
 * Share a link: the phone's share sheet when there is one (X, Telegram,
 * WhatsApp…), otherwise copy it. Returns what happened, for the toast.
 */
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function postUrl(postId: string): string {
  return `${window.location.origin}/post/${postId}`;
}
