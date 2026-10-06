"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBan, IconBell, IconFeed, IconInfo, IconLive, IconMoon, IconShield, IconPlus, IconSearch, IconSettings, IconSun, IconTop, IconUser, IconWallet } from "@/components/icons";
import { LIGHT_MODE_ENABLED } from "@/lib/brand";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { useNotifications } from "@/context/NotificationsContext";
import { shortWallet } from "@/lib/format";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";
import { LiveColumn } from "./LiveColumn";
import { ZaprMark } from "./ZaprMark";
import { ConnectModal } from "./modals/ConnectModal";
import { ComposerModal } from "./modals/ComposerModal";
import { PumpModal } from "./modals/PumpModal";
import { CreatorZapModal } from "./modals/CreatorZapModal";
import { OnboardModal } from "./modals/OnboardModal";
import { WelcomeModal } from "./modals/WelcomeModal";
import { ReportModal } from "./modals/ReportModal";
import { LinkWalletModal } from "./modals/LinkWalletModal";
import { SafeBoundary } from "./SafeBoundary";
import { SiteFooter } from "./SiteFooter";
import { PRIVY_APP_ID, reportSocialLoginConfig } from "@/lib/social-login";

// Google / Apple sign-in (Privy): only loaded when configured, never on the server.
const PrivyBridge = PRIVY_APP_ID ? dynamic(() => import("./PrivyBridge"), { ssr: false }) : null;

const NAV = [
  { href: "/", Icon: IconFeed, label: "Feed" },
  { href: "/live", Icon: IconLive, label: "Live" },
  { href: "/leaderboard", Icon: IconTop, label: "Top" },
  { href: "/wallet", Icon: IconWallet, label: "Wallet" },
  { href: "/profile", Icon: IconUser, label: "Profile" },
];

// Desktop rail: the same pages plus Notifications (on mobile it is the bell in
// the top bar, the bottom nav has no room left).
const RAIL = [...NAV.slice(0, 3), { href: "/notifications", Icon: IconBell, label: "Notifications" }, ...NAV.slice(3)];

/** Unread count on an icon; nothing when there is nothing new. */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="unread-badge" aria-label={`${count} new`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, openComposer, openConnect, activeModal } = useUI();
  const { user, status, requireAuth, logout, walletAddress, userWallets } = useSession();
  // The wallet in use right now (a linked one, maybe), else the account's main wallet.
  const shownWallet = walletAddress && userWallets.includes(walletAddress) ? walletAddress : user?.wallet;
  const { unread } = useNotifications();

  // Google sign-in missing or misconfigured: say why in the browser console (F12).
  useEffect(() => reportSocialLoginConfig(), []);

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
          <IconSearch />
        </Link>
        <div className="tb-actions">
          {user && (
            <Link
              href="/notifications"
              className={`icon-btn tb-notif${isActive("/notifications", pathname) ? " active" : ""}`}
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell />
              <UnreadBadge count={unread} />
            </Link>
          )}
          <span className={`net-badge ${IS_MAINNET ? "danger" : "safe"}`} title="Solana network">
            {CLUSTER}
          </span>
          {LIGHT_MODE_ENABLED && (
            <button className="icon-btn tb-theme" onClick={toggleTheme} aria-label="Switch theme" title="Switch theme">
              {theme === "dark" ? <IconMoon /> : <IconSun />}
            </button>
          )}
          <button
            className={`btn btn-sm${user ? " btn-accent-soft tb-wallet" : " btn-primary"}`}
            onClick={onWalletBtn}
            title={user ? "Disconnect" : "Connect"}
          >
            {user && shownWallet ? shortWallet(shownWallet) : "Connect"}
          </button>
        </div>
      </header>

      <div className={`app${showLiveCol ? "" : " no-live"}`}>
        <nav className="rail" aria-label="Navigation">
          {RAIL.map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`rail-item${isActive(href, pathname) ? " active" : ""}`}
              title={label}
            >
              <span className="rail-ico">
                <Icon />
                {href === "/notifications" && <UnreadBadge count={unread} />}
              </span>
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/settings" className={`rail-item${isActive("/settings", pathname) ? " active" : ""}`} title="Settings">
            <IconSettings />
            <span>Settings</span>
          </Link>
          <Link
            href="/how-it-works"
            className={`rail-item${isActive("/how-it-works", pathname) ? " active" : ""}`}
            title="How it works"
          >
            <IconInfo />
            <span>Guide</span>
          </Link>
          {user?.isAdmin && (
            <Link href="/admin" className={`rail-item${isActive("/admin", pathname) ? " active" : ""}`} title="Admin">
              <IconShield />
              <span>Admin</span>
            </Link>
          )}
          <button className="rail-post" onClick={onPost} aria-label="Post" title="Post">
            <IconPlus />
          </button>
        </nav>

        <main className="main">
          {user?.banned && (
            <div className="suspended-banner" role="alert">
              <IconBan />
              <span>
                <b>Your account is suspended.</b> You can still browse, but you can&apos;t post, comment, zap or follow.
              </span>
            </div>
          )}
          {children}
          <SiteFooter />
        </main>

        {showLiveCol && <LiveColumn />}
      </div>

      {/* Mobile */}
      <button className="fab" onClick={onPost} aria-label="Post">
        <IconPlus />
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
      {activeModal === "report" && <ReportModal />}
      {activeModal === "link" && <LinkWalletModal />}
      <WelcomeModal />
      {PrivyBridge && (
        // A wrong App ID only turns Google / Apple sign-in off, never the site.
        <SafeBoundary name="Google / Apple sign-in">
          <PrivyBridge />
        </SafeBoundary>
      )}
    </>
  );
}
