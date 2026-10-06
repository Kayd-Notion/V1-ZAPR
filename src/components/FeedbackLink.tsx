"use client";
import { useUI } from "@/context/UIContext";
import { FEEDBACK_ON } from "@/lib/contact";

/** "Feedback" link (footer, error page…), hidden until a form or e-mail is set. */
export function FeedbackLink({ label = "Feedback", className }: { label?: string; className?: string }) {
  const { openFeedback } = useUI();
  if (!FEEDBACK_ON) return null;
  return (
    <button type="button" className={`link-btn${className ? ` ${className}` : ""}`} onClick={openFeedback}>
      {label}
    </button>
  );
}
