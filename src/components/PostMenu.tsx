"use client";
import { useEffect, useRef, useState } from "react";
import { IconEyeOff, IconFlag, IconMore, IconTrash } from "@/components/icons";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { api } from "@/lib/api";
import type { ClientPost } from "@/lib/client-types";

/**
 * The "⋯" menu of a post:
 *  - its author can delete it while it has no zap (the server checks it too);
 *  - anyone signed in can report someone else's post;
 *  - admins can hide it.
 * Destructive actions ask for a second tap.
 */
export function PostMenu({ post, onDeleted }: { post: ClientPost; onDeleted: () => void }) {
  const { user, requireAuth } = useSession();
  const { toast, bumpData, openReport } = useUI();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<null | "delete" | "hide">(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const mine = user?.id === post.userId;
  const admin = Boolean(user?.isAdmin);
  const zapped = post.pumped > 0;

  const run = async (kind: "delete" | "hide") => {
    if (confirming !== kind) {
      setConfirming(kind);
      return;
    }
    setBusy(true);
    try {
      if (kind === "delete") await api.deletePost(post.id);
      else await api.adminAction({ action: "hide_post", id: post.id });
      toast(kind === "delete" ? "Post deleted." : "Post hidden.");
      setOpen(false);
      bumpData();
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const report = () => {
    setOpen(false);
    if (!requireAuth("Connect your wallet to report a post.")) return;
    openReport({ type: "post", id: post.id, label: `@${post.author.handle}'s post` });
  };

  return (
    <div className="post-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        className="pa-btn pm-trigger"
        aria-label="More options"
        aria-expanded={open}
        title="More"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(null);
        }}
      >
        <IconMore />
      </button>
      {open && (
        <div className="pm-list" role="menu">
          {mine && (
            <button
              role="menuitem"
              className={`pm-item danger${confirming === "delete" ? " confirm" : ""}`}
              onClick={() => run("delete")}
              disabled={zapped || busy}
            >
              <IconTrash />
              <span>
                {confirming === "delete" ? "Tap again to delete" : "Delete post"}
                {zapped && <small>Zapped posts can&apos;t be deleted</small>}
              </span>
            </button>
          )}
          {!mine && (
            <button role="menuitem" className="pm-item" onClick={report}>
              <IconFlag />
              <span>Report post</span>
            </button>
          )}
          {admin && (
            <button
              role="menuitem"
              className={`pm-item danger${confirming === "hide" ? " confirm" : ""}`}
              onClick={() => run("hide")}
              disabled={busy}
            >
              <IconEyeOff />
              <span>
                {confirming === "hide" ? "Tap again to hide" : "Hide post"}
                <small>Admin: removes it from everywhere</small>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
