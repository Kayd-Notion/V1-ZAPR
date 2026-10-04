"use client";
import { useState } from "react";
import { IconFlag } from "@/components/icons";
import { useUI } from "@/context/UIContext";
import { api } from "@/lib/api";
import type { ReportReason } from "@/lib/client-types";
import { Modal } from "../Modal";

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: "scam", label: "Scam or phishing", hint: "Fake giveaway, drainer link, impersonation" },
  { id: "spam", label: "Spam", hint: "Repeated, off-topic or bot content" },
  { id: "harassment", label: "Harassment", hint: "Threats, bullying, doxxing" },
  { id: "hate", label: "Hate speech", hint: "Attacks on a group of people" },
  { id: "sexual", label: "Sexual content", hint: "Nudity, or anything involving minors" },
  { id: "illegal", label: "Illegal", hint: "Something against the law" },
  { id: "other", label: "Something else", hint: "Tell us below" },
];

/** Report a post or a comment: a reason, optional details, sent to the admins. */
export function ReportModal() {
  const { reportTarget, closeModal, toast } = useUI();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!reportTarget) return null;

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const r = await api.report({ targetType: reportTarget.type, targetId: reportTarget.id, reason, details });
      toast(r.duplicate ? "You already reported this. Thanks." : "Thanks. The ZAPR team will take a look.");
      closeModal();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Report ${reportTarget.label}`} icon={<IconFlag />} onClose={closeModal}>
      <p className="muted report-intro">What&apos;s wrong with it? Your report stays private.</p>
      <div className="report-reasons" role="radiogroup">
        {REASONS.map((r) => (
          <button
            key={r.id}
            role="radio"
            aria-checked={reason === r.id}
            className={`report-reason${reason === r.id ? " active" : ""}`}
            onClick={() => setReason(r.id)}
          >
            <b>{r.label}</b>
            <small>{r.hint}</small>
          </button>
        ))}
      </div>
      <label className="field-label">Details (optional)</label>
      <textarea
        className="field"
        rows={2}
        maxLength={300}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything that helps us understand"
        style={{ resize: "none" }}
      />
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={send} disabled={!reason || busy}>
        {busy ? "Sending…" : "Send report"}
      </button>
    </Modal>
  );
}
