"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, Moon, Plus, Radio, Search, Settings, Sun, Trophy, User, Wallet } from "lucide-react";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { shortWallet } from "@/lib/format";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";
import { LiveColumn } from "./LiveColumn";
import { ZaprMark } from "./ZaprMark";
import { ConnectModal } from "./modals/ConnectModal";
import { ComposerModal } from "./modals/ComposerModal";
import { PumpModal } from "./modals/PumpModal";
import { OnboardModal } from "./modals/OnboardModal";

const NAV = [
  { href: "/", Icon: House, label: "Feed" },
  { href: "/live", Icon: Radio, label: "Live" },
  { href: "/leaderboard", Icon: Trophy, label: "Top" },
  { href: "/wallet", Icon: Wallet, label: "Wallet" },
  { href: "/profile", Icon: User, label: "Profil" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme, openComposer, openConnect, activeModal } = useUI();
  const { user, requireAuth, logout, walletAddress } = useSession();
  const [q, setQ] = useState("");

  const onWalletBtn = () => {
    if (user) logout();
    else openConnect("Connecte ton wallet Solana pour entrer dans l'arène.");
  };

  const onPost = () => {
    if (!requireAuth("Connecte ton wallet pour poster.")) return;
    openComposer();
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };

  // The side live column would duplicate the /live page.
  const showLiveCol = pathname !== "/live";

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="ZAPR — accueil">
          <ZaprMark className="logo-mark" />
          <span className="logo-text">ZAPR</span>
        </Link>
        <form className="tb-search" onSubmit={onSearch} role="search">
          <Search />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un post, un degen, un #tag…" />
        </form>
        <div className="tb-actions">
          <Link href="/explore" className="icon-btn tb-search-btn" aria-label="Chercher">
            <Search />
          </Link>
          <span className={`net-badge ${IS_MAINNET ? "danger" : "safe"}`} title="Réseau Solana">
            {CLUSTER}
          </span>
          <button className="icon-btn tb-theme" onClick={toggleTheme} aria-label="Changer de thème" title="Changer de thème">
            {theme === "dark" ? <Moon /> : <Sun />}
          </button>
          <button className="btn btn-primary tb-post" onClick={onPost}>
            <Plus /> <span>Poster</span>
          </button>
          <button
            className={`btn btn-sm${user ? " btn-accent-soft" : " btn-primary"}`}
            onClick={onWalletBtn}
            title={user ? "Déconnecter" : "Connecter"}
          >
            {user ? shortWallet(walletAddress || user.wallet) : "Connecter"}
          </button>
        </div>
      </header>

      <div className={`app${showLiveCol ? "" : " no-live"}`}>
        <nav className="rail" aria-label="Navigation">
          {NAV.map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`rail-item${isActive(href, pathname) ? " active" : ""}`}
              title={label}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/settings" className={`rail-item${isActive("/settings", pathname) ? " active" : ""}`} title="Réglages">
            <Settings />
            <span>Réglages</span>
          </Link>
          <button className="rail-post" onClick={onPost} aria-label="Poster" title="Poster">
            <Plus />
          </button>
        </nav>

        <main className="main">{children}</main>

        {showLiveCol && <LiveColumn />}
      </div>

      {/* Mobile */}
      <button className="fab" onClick={onPost} aria-label="Poster">
        <Plus />
      </button>
      <nav className="bottom-nav" aria-label="Navigation">
        {NAV.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={`bn-item${isActive(href, pathname) ? " active" : ""}`}>
            <Icon />
            {label}
          </Link>
        ))}
      </nav>

      {activeModal === "connect" && <ConnectModal />}
      {activeModal === "composer" && <ComposerModal />}
      {activeModal === "pump" && <PumpModal />}
      {activeModal === "onboard" && <OnboardModal />}
    </>
  );
}
