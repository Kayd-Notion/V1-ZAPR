"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { CreatorZapModal } from "./modals/CreatorZapModal";
import { OnboardModal } from "./modals/OnboardModal";

const NAV = [
  { href: "/", Icon: House, label: "Feed" },
  { href: "/live", Icon: Radio, label: "Live" },
  { href: "/leaderboard", Icon: Trophy, label: "Top" },
  { href: "/wallet", Icon: Wallet, label: "Wallet" },
  { href: "/profile", Icon: User, label: "Profile" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, openComposer, openConnect, activeModal } = useUI();
  const { user, status, requireAuth, logout, walletAddress } = useSession();

  // Visitors (wallet not connected) see every bolt of the site grey; each one
  // lights up on hover. While the session is loading, keep the pre-paint hint.
  useEffect(() => {
    if (status === "loading") return;
    const guest = status === "anonymous" || status === "authenticating";
    document.documentElement.setAttribute("data-auth", guest ? "guest" : "in");
  }, [status]);

  const onWalletBtn = () => {
    if (user) logout();
    else openConnect("Connect your Solana wallet to enter the arena.");
  };

  const onPost = () => {
    if (!requireAuth("Connect your wallet to post.")) return;
    openComposer();
  };

  // The side live column would duplicate the /live page.
  const showLiveCol = pathname !== "/live";

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="ZAPR home">
          <ZaprMark className="logo-mark" />
          <span className="logo-text">ZAPR</span>
        </Link>
        <Link href="/explore" className="icon-btn tb-search-btn" aria-label="Search" title="Search">
          <Search />
        </Link>
        <div className="tb-actions">
          <span className={`net-badge ${IS_MAINNET ? "danger" : "safe"}`} title="Solana network">
            {CLUSTER}
          </span>
          <button className="icon-btn tb-theme" onClick={toggleTheme} aria-label="Switch theme" title="Switch theme">
            {theme === "dark" ? <Moon /> : <Sun />}
          </button>
          <button className="btn btn-primary tb-post" onClick={onPost}>
            <Plus /> <span>Post</span>
          </button>
          <button
            className={`btn btn-sm${user ? " btn-accent-soft" : " btn-primary"}`}
            onClick={onWalletBtn}
            title={user ? "Disconnect" : "Connect"}
          >
            {user ? shortWallet(walletAddress || user.wallet) : "Connect"}
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
          <Link href="/settings" className={`rail-item${isActive("/settings", pathname) ? " active" : ""}`} title="Settings">
            <Settings />
            <span>Settings</span>
          </Link>
          <button className="rail-post" onClick={onPost} aria-label="Post" title="Post">
            <Plus />
          </button>
        </nav>

        <main className="main">{children}</main>

        {showLiveCol && <LiveColumn />}
      </div>

      {/* Mobile */}
      <button className="fab" onClick={onPost} aria-label="Post">
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
      {activeModal === "creatorZap" && <CreatorZapModal />}
      {activeModal === "onboard" && <OnboardModal />}
    </>
  );
}
