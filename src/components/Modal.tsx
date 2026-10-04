"use client";
import { useEffect, useRef } from "react";
import { IconClose } from "@/components/icons";

export function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  /** Optional icon shown before the title. */
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Keyboard and screen readers land in the dialog; focus goes back where it
  // was when it closes.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus?.();
  }, []);

  // Close on Escape.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h3>
            {icon}
            {title}
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
