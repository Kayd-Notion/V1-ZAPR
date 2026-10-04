"use client";
import { useEffect, useRef, useState } from "react";
import { IconMore, IconTrash } from "@/components/icons";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { api } from "@/lib/api";
import type { ClientPost } from "@/lib/client-types";

/**
 * The "⋯" menu of a post. Its author can delete it while it has no zap (the
 * server checks it too); deleting asks for a second tap. Nothing to show for
 * anyone else yet.
 */
export function PostMenu({ post, onDeleted }: { post: ClientPost; onDeleted: () => void }) {
  const { user } = useSession();
  const { toast, bumpData } = useUI();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
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
  if (!mine) return null;
  const zapped = post.pumped > 0;

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await api.deletePost(post.id);
      toast("Post deleted.");
      setOpen(false);
      bumpData();
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the post.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
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
          setConfirming(false);
        }}
      >
        <IconMore />
      </button>
      {open && (
        <div className="pm-list" role="menu">
          <button
            role="menuitem"
            className={`pm-item danger${confirming ? " confirm" : ""}`}
            onClick={remove}
            disabled={zapped || busy}
          >
            <IconTrash />
            <span>
              {confirming ? "Tap again to delete" : "Delete post"}
              {zapped && <small>Zapped posts can&apos;t be deleted</small>}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
