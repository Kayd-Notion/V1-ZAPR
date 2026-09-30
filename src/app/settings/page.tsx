"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBack, IconLogOut } from "@/components/icons";
import { ZaprEmpty } from "@/components/ZaprMark";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { api } from "@/lib/api";
import { shortWallet } from "@/lib/format";
import { LIGHT_MODE_ENABLED } from "@/lib/brand";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useSession();
  const { theme, toggleTheme, toast, openConnect } = useUI();
  const [bio, setBio] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setBio(user.bio);
      setHandle(user.handle);
    }
  }, [user]);

  if (!user) {
    return (
      <ZaprEmpty title="Connect to manage your account.">
        <button
          className="btn btn-primary"
          onClick={() => openConnect("Connect your wallet to open settings.")}
        >
          Connect
        </button>
      </ZaprEmpty>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateMe({ bio, handle });
      setUser(res.user);
      toast("Profile updated.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const setPrivacy = async (patch: { hidePumpHistory?: boolean; anonymizePumps?: boolean }) => {
    try {
      const res = await api.updateMe(patch);
      setUser(res.user);
      toast("Got it.");
    } catch {
      toast("Couldn't update.");
    }
  };

  return (
    <section>
      <div className="subbar">
        <button className="icon-btn" onClick={() => router.push("/profile")} aria-label="Back">
          <IconBack />
        </button>
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Profile</div>
        <div style={{ padding: "14px 16px" }}>
          <label className="field-label">Username</label>
          <input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={20} />
        </div>
        <div style={{ padding: "0 16px 14px" }}>
          <label className="field-label">Bio</label>
          <textarea
            className="field"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={240}
            style={{ resize: "none" }}
          />
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Privacy</div>
        <div className="settings-row">
          <div className="sr-text">
            Hide my zap history
            <small>Hides the &ldquo;SOL sent&rdquo; total on your public profile</small>
          </div>
          <div
            className={`toggle${user.hidePumpHistory ? " on" : ""}`}
            onClick={() => setPrivacy({ hidePumpHistory: !user.hidePumpHistory })}
          >
            <span className="tg-switch" />
          </div>
        </div>
        <div className="settings-row">
          <div className="sr-text">
            Make my zaps anonymous by default
            <small>Show up as &ldquo;Anonymous zapper&rdquo; in zap histories</small>
          </div>
          <div
            className={`toggle${user.anonymizePumps ? " on" : ""}`}
            onClick={() => setPrivacy({ anonymizePumps: !user.anonymizePumps })}
          >
            <span className="tg-switch" />
          </div>
        </div>
      </div>

      {LIGHT_MODE_ENABLED && (
        <div className="settings-group">
          <div className="sg-title">Appearance</div>
          <div className="settings-row">
            <div className="sr-text">Dark mode</div>
            <div className={`toggle${theme === "dark" ? " on" : ""}`} onClick={toggleTheme}>
              <span className="tg-switch" />
            </div>
          </div>
        </div>
      )}

      <div className="settings-group">
        <div className="sg-title">Account</div>
        <div className="settings-row" style={{ cursor: "pointer" }} onClick={() => logout()}>
          <div className="sr-text">
            Disconnect wallet
            <small>{shortWallet(user.wallet)}</small>
          </div>
          <IconLogOut className="sr-ico" />
        </div>
      </div>
    </section>
  );
}
