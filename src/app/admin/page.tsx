"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconAlert, IconBan, IconCheck, IconEyeOff, IconFlag, IconShield, IconTrash, IconZap } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { ZaprLoader } from "@/components/ZaprMark";
import NotFound from "../not-found";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { useNow } from "@/context/LiveContext";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { fmtSol, timeAgo } from "@/lib/format";
import type { AdminAction, AdminOverview } from "@/lib/api-types";
import type { ClientReportGroup, ReportReason } from "@/lib/client-types";

const REASON_LABEL: Record<ReportReason, string> = {
  scam: "Scam",
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate",
  sexual: "Sexual",
  illegal: "Illegal",
  other: "Other",
};

/**
 * Moderation, for the founder only (NEXT_PUBLIC_FOUNDER_WALLET): key numbers, open
 * reports with one-click actions, hidden posts and banned accounts. The
 * server checks the admin rights on every call.
 */
export default function AdminPage() {
  const { user, status } = useSession();
  const { toast, bumpData } = useUI();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.adminOverview());
      setDenied(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setDenied(true);
      else toast("Couldn't load the admin data.");
    }
  }, [toast]);

  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  if (status === "loading") return <ZaprLoader />;
  // Anyone but the founder sees a plain "page not found".
  if (!user?.isAdmin || denied) return <NotFound />;
  if (!data) return <ZaprLoader label="Loading moderation…" />;

  const act = async (key: string, input: Parameters<typeof api.adminAction>[0], done: string) => {
    setBusy(key);
    try {
      await api.adminAction(input);
      toast(done);
      bumpData();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const s = data.stats;
  return (
    <section className="admin">
      <div className="subbar">
        <div className="page-title">
          <IconShield /> Admin
        </div>
      </div>

      <div className="stats-grid admin-stats">
        <Stat value={s.users} label="Users" sub={`+${s.newUsers24h} in 24h`} />
        <Stat value={s.livePosts} label="Live posts" sub={s.hiddenPosts ? `${s.hiddenPosts} hidden` : undefined} />
        <Stat value={s.zaps} label="Zaps" sub={`${s.zaps24h} in 24h`} />
        <Stat value={`${fmtSol(s.solZapped)}`} label="SOL zapped" sub={`${fmtSol(s.solZapped24h)} in 24h`} accent />
        <Stat value={`${fmtSol(s.platformRevenue)}`} label="Platform revenue (SOL)" accent />
        <Stat value={s.openReports} label="Open reports" warn={s.openReports > 0} />
      </div>

      <p className={`admin-check${s.unattributedZaps || s.postsOutOfSync ? " warn" : ""}`}>
        {s.unattributedZaps || s.postsOutOfSync ? <IconAlert /> : <IconCheck />}
        <span>
          <b>Rankings check:</b>{" "}
          {s.unattributedZaps || s.postsOutOfSync
            ? `${s.unattributedZaps} zap(s) without a creator, ${s.postsOutOfSync} live post(s) whose total doesn't match its zaps. Leaderboards use the zap log; tell the developer.`
            : "every zap is tied to its creator and every live post's total matches its zaps."}{" "}
          Leaderboards count 100 % of each zap; {s.selfZaps} self-zap{s.selfZaps === 1 ? "" : "s"} left out.
        </span>
      </p>

      {data.security && <SecurityCheck s={data.security} />}

      {data.network && (
        <p className={`admin-check${data.network.serverRpcOk === false ? " warn" : ""}`}>
          {data.network.serverRpcOk === false ? <IconAlert /> : <IconCheck />}
          <span>
            <b>Network:</b> Solana {data.network.cluster} · browser RPC {data.network.browserRpc} · server RPC{" "}
            {data.network.serverRpc}{" "}
            {data.network.serverRpcOk === true
              ? "(on the right network)."
              : data.network.serverRpcOk === false
                ? "is on ANOTHER network: zaps are paused. Fix NEXT_PUBLIC_SOLANA_RPC / SOLANA_RPC_URL in Vercel."
                : "(couldn't be reached right now)."}
          </span>
        </p>
      )}

      <div className="section-title">
        <IconFlag /> Reports ({data.reports.length})
      </div>
      {data.reports.length === 0 ? (
        <p className="faint admin-empty">No open report. All clear.</p>
      ) : (
        data.reports.map((r) => <ReportCard key={`${r.targetType}:${r.targetId}`} r={r} busy={busy} act={act} />)
      )}

      <div className="section-title">
        <IconEyeOff /> Hidden posts ({data.hiddenPosts.length})
      </div>
      {data.hiddenPosts.length === 0 ? (
        <p className="faint admin-empty">No hidden post.</p>
      ) : (
        data.hiddenPosts.map((p) => (
          <div className="admin-row" key={p.id}>
            <Avatar id={p.author.id} handle={p.author.handle} src={p.author.avatarUrl} size="sm" />
            <div className="ar-body">
              <b>@{p.author.handle}</b>
              <span className="ar-text">{p.text}</span>
            </div>
            <button
              className="btn btn-sm"
              disabled={busy !== null}
              onClick={() => act(`unhide:${p.id}`, { action: "unhide_post", id: p.id }, "Post visible again.")}
            >
              Unhide
            </button>
          </div>
        ))
      )}

      <div className="section-title">
        <IconBan /> Banned accounts ({data.bannedUsers.length})
      </div>
      {data.bannedUsers.length === 0 ? (
        <p className="faint admin-empty">Nobody is banned.</p>
      ) : (
        data.bannedUsers.map((u) => (
          <div className="admin-row" key={u.id}>
            <Avatar id={u.id} handle={u.handle} src={u.avatarUrl} size="sm" />
            <div className="ar-body">
              <Link href={`/profile/${u.handle}`}>
                <b>@{u.handle}</b>
              </Link>
              <span className="ar-text">{u.wallet}</span>
            </div>
            <button
              className="btn btn-sm"
              disabled={busy !== null}
              onClick={() => act(`unban:${u.id}`, { action: "unban_user", id: u.id }, `@${u.handle} is back.`)}
            >
              Unban
            </button>
          </div>
        ))
      )}
    </section>
  );
}

function Stat({
  value,
  label,
  sub,
  accent,
  warn,
}: {
  value: string | number;
  label: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`stat-box${warn ? " warn" : ""}`}>
      <div className={`sb-val${accent ? " accent" : ""}`}>
        {accent && <IconZap />}
        {value}
      </div>
      <div className="sb-label">{label}</div>
      {sub && <div className="sb-sub">{sub}</div>}
    </div>
  );
}

function ReportCard({
  r,
  busy,
  act,
}: {
  r: ClientReportGroup;
  busy: string | null;
  act: (key: string, input: { action: AdminAction; id: string; targetType?: "post" | "comment"; targetId?: string }, done: string) => void;
}) {
  const now = useNow(60_000);
  const key = `${r.targetType}:${r.targetId}`;
  const gone = r.text === null;
  const isPost = r.targetType === "post";

  return (
    <div className="report-card">
      <div className="rc-head">
        <span className="rc-type">{isPost ? "Post" : "Comment"}</span>
        <b>
          {r.count} report{r.count > 1 ? "s" : ""}
        </b>
        <span className="faint">· {timeAgo(r.lastAt, now)} ago</span>
        <span className="rc-reasons">
          {r.reasons.map((x) => (
            <span key={x} className={`rc-reason r-${x}`}>
              {REASON_LABEL[x]}
            </span>
          ))}
        </span>
      </div>

      {r.author && (
        <div className="rc-author">
          <Avatar id={r.author.id} handle={r.author.handle} src={r.author.avatarUrl} size="xs" />
          <Link href={`/profile/${r.author.handle}`}>@{r.author.handle}</Link>
          {r.author.banned && <span className="rc-flag">banned</span>}
          {r.hidden && <span className="rc-flag">hidden</span>}
        </div>
      )}
      <div className={`rc-text${gone ? " faint" : ""}`}>
        {gone ? "Already gone (deleted or expired)." : r.text}
      </div>
      {r.postId && !gone && (
        <Link href={`/post/${r.postId}`} className="rc-open">
          Open the post
        </Link>
      )}
      {r.details.length > 0 && (
        <ul className="rc-details">
          {r.details.map((d, i) => (
            <li key={i}>&ldquo;{d}&rdquo;</li>
          ))}
        </ul>
      )}

      <div className="rc-actions">
        {!gone && isPost && !r.hidden && (
          <button
            className="btn btn-sm btn-danger"
            disabled={busy !== null}
            onClick={() => act(`hide:${key}`, { action: "hide_post", id: r.targetId }, "Post hidden.")}
          >
            <IconEyeOff /> Hide post
          </button>
        )}
        {!gone && !isPost && (
          <button
            className="btn btn-sm btn-danger"
            disabled={busy !== null}
            onClick={() => act(`del:${key}`, { action: "delete_comment", id: r.targetId }, "Comment deleted.")}
          >
            <IconTrash /> Delete comment
          </button>
        )}
        {r.author && !r.author.banned && (
          <button
            className="btn btn-sm btn-danger"
            disabled={busy !== null}
            onClick={() =>
              act(
                `ban:${key}`,
                { action: "ban_user", id: r.author!.id, targetType: r.targetType, targetId: r.targetId },
                `@${r.author!.handle} is banned.`,
              )
            }
          >
            <IconBan /> Ban @{r.author.handle}
          </button>
        )}
        <button
          className="btn btn-sm"
          disabled={busy !== null}
          onClick={() =>
            act(`dismiss:${key}`, { action: "dismiss", id: r.targetId, targetType: r.targetType }, "Report dismissed.")
          }
        >
          <IconCheck /> Dismiss
        </button>
      </div>
    </div>
  );
}

/** Settings that must be right before real users (nothing secret is shown). */
function SecurityCheck({ s }: { s: NonNullable<AdminOverview["security"]> }) {
  const problems = [
    !s.sessionSecretOk && "SESSION_SECRET is missing or shorter than 32 characters: sessions could be forged. Set it in Vercel now.",
    !s.onchainVerifyOn && "On-chain verification is OFF: zaps are recorded without checking the blockchain.",
    !s.founderWalletSet && "NEXT_PUBLIC_FOUNDER_WALLET isn't set: the platform share goes to a demo address.",
    !s.cronSecretSet && "CRON_SECRET isn't set (optional): anyone can trigger the nightly clean-up.",
  ].filter(Boolean) as string[];
  const serious = !s.sessionSecretOk || !s.onchainVerifyOn || !s.founderWalletSet;
  return (
    <p className={`admin-check${serious ? " warn" : ""}`}>
      {problems.length ? <IconAlert /> : <IconCheck />}
      <span>
        <b>Security check:</b>{" "}
        {problems.length ? problems.join(" ") : "session secret, on-chain verification, platform wallet and cron secret are set."}
      </span>
    </p>
  );
}
