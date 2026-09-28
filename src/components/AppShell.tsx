"use client";
import { usePathname, useRouter } from "next/navigation";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { shortWallet } from "@/lib/format";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";
import { RightRail } from "./RightRail";
import { ConnectModal } from "./modals/ConnectModal";
import { ComposerModal } from "./modals/ComposerModal";
import { PumpModal } from "./modals/PumpModal";
import { OnboardModal } from "./modals/OnboardModal";

const NAV = [
  { key: "feed", href: "/", icon: "🏠", label: "Accueil" },
  { key: "explore", href: "/explore", icon: "🔍", label: "Explorer" },
  { key: "leaderboard", href: "/leaderboard", icon: "🏆", label: "Classement" },
  { key: "notifications", href: "/notifications", icon: "🔔", label: "Notifications" },
  { key: "wallet", href: "/wallet", icon: "💳", label: "Wallet" },
  { key: "profile", href: "/profile", icon: "👤", label: "Profil" },
  { key: "settings", href: "/settings", icon: "⚙️", label: "Paramètres" },
];

const MOBILE_NAV = NAV.filter((n) =>
  ["feed", "explore", "leaderboard", "notifications", "wallet", "profile"].includes(n.key),
);

function titleFor(pathname: string): string {
  if (pathname === "/") return "Accueil";
  if (pathname.startsWith("/explore")) return "Explorer";
  if (pathname.startsWith("/leaderboard")) return "Classement";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/wallet")) return "Wallet";
  if (pathname.startsWith("/profile")) return "Profil";
  if (pathname.startsWith("/settings")) return "Paramètres";
  if (pathname.startsWith("/post")) return "Post";
  return "";
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme, openComposer, openConnect, activeModal } = useUI();
  const { user, requireAuth, logout, walletAddress } = useSession();

  const onWalletBtn = () => {
    if (user) logout();
    else openConnect("Connecte ton wallet Solana pour rejoindre pump.social.");
  };

  const onPost = () => {
    if (!requireAuth("Connecte ton wallet pour poster.")) return;
    openComposer();
  };

  return (
    <>
      <div className="app">
        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="brand">
            <div className="logo-mark">P</div>
            <span className="logo-text">
              pump<b>.social</b>
            </span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`nav-item${isActive(n.href, pathname) ? " active" : ""}`}
              onClick={() => router.push(n.href)}
            >
              <span className="ni-icon">{n.icon}</span> {n.label}
            </button>
          ))}
          <button className="post-cta" onClick={onPost}>
            Poster
          </button>
        </aside>

        {/* Main column */}
        <main className="main">
          <header className="header">
            <div className="brand">
              <div className="logo-mark">P</div>
              <span className="logo-text">
                pump<b>.social</b>
              </span>
            </div>
            <div className="page-title">{titleFor(pathname)}</div>
            <div className="header-actions">
              <span className={`net-badge ${IS_MAINNET ? "danger" : "safe"}`} title="Réseau Solana">
                {CLUSTER}
              </span>
              <button className="icon-btn" onClick={toggleTheme} title="Changer de thème">
                {theme === "dark" ? "🌙" : "☀️"}
              </button>
              <button
                className={`btn btn-sm${user ? " btn-accent-soft" : ""}`}
                onClick={onWalletBtn}
                title={user ? "Déconnecter" : "Connecter"}
              >
                {user ? shortWallet(walletAddress || user.wallet) : "Connecter"}
              </button>
            </div>
          </header>
          {children}
        </main>

        {/* Right rail (large screens) */}
        <RightRail />
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        {MOBILE_NAV.map((n) => (
          <button
            key={n.key}
            className={`bn-item${isActive(n.href, pathname) ? " active" : ""}`}
            onClick={() => router.push(n.href)}
          >
            <span className="ni-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Modals */}
      {activeModal === "connect" && <ConnectModal />}
      {activeModal === "composer" && <ComposerModal />}
      {activeModal === "pump" && <PumpModal />}
      {activeModal === "onboard" && <OnboardModal />}
    </>
  );
}
