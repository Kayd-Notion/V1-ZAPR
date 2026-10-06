"use client";
import { useMemo, useState } from "react";
import { IconComment, IconExternal } from "@/components/icons";
import { Modal } from "../Modal";
import { useUI } from "@/context/UIContext";
import { CONTACT_EMAIL, FEEDBACK_URL, describePage, feedbackMailto, type PageDetails } from "@/lib/contact";

/**
 * "Report a bug or send feedback": opens the team's form or the person's own
 * mail app. ZAPR sends nothing itself and never adds an IP address or wallet.
 */
export function FeedbackModal() {
  const { closeModal, toast } = useUI();
  const [copied, setCopied] = useState(false);

  const details = useMemo<PageDetails>(() => {
    const w = typeof window === "undefined" ? null : window;
    const device = w
      ? `${simpleDevice(navigator.userAgent)}, screen ${w.innerWidth}×${w.innerHeight}`
      : "unknown";
    return { page: w?.location.href ?? "", device, time: new Date().toISOString() };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(describePage(details));
      setCopied(true);
    } catch {
      toast("Couldn't copy. Select the details below instead.");
    }
  };

  return (
    <Modal title="Report a bug or send feedback" icon={<IconComment />} onClose={closeModal}>
      <div className="fb">
        <p>
          Something broken, confusing or missing? Tell us: during the beta, every message helps. A good report says
          <b> what you did</b>, <b>what happened</b> and <b>what you expected</b>. A screenshot helps a lot.
        </p>
        <pre className="fb-details" aria-label="Page details">
          {describePage(details)}
        </pre>
        <div className="fb-actions">
          {FEEDBACK_URL && (
            <a className="btn btn-primary btn-block" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
              Open the feedback form <IconExternal />
            </a>
          )}
          {CONTACT_EMAIL && (
            <a className={`btn btn-block${FEEDBACK_URL ? "" : " btn-primary"}`} href={feedbackMailto(CONTACT_EMAIL, details)}>
              Email {CONTACT_EMAIL}
            </a>
          )}
          <button className="btn btn-block" onClick={copy}>
            {copied ? "Copied" : "Copy the page details"}
          </button>
        </div>
        <p className="faint fb-note">
          ZAPR doesn&apos;t record your IP address and adds nothing about you or your wallet. Never send your recovery
          phrase or private key: the ZAPR team will never ask for it.
        </p>
      </div>
    </Modal>
  );
}

/** "iPhone", "Android", "Mac · Chrome"…: enough to reproduce, nothing identifying. */
function simpleDevice(ua: string): string {
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "other";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Brave/.test(ua)
      ? "Brave"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "browser";
  return `${os} · ${browser}`;
}
