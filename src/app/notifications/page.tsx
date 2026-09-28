"use client";
import { timeAgo } from "@/lib/format";

const H = 3600_000;
const now = Date.now();

// Illustrative notifications (real-time notifications are a later phase — the
// backend event stream isn't part of the Phase 1 scope).
const NOTIFS = [
  { id: "n1", type: "pump", icon: "⚡", text: "**@ghostwhale** a pumpé ton post de **2.5 SOL**", at: now - 0.5 * H },
  { id: "n2", type: "rank", icon: "📈", text: "Ton post est entré dans le **top mondial** 🎉", at: now - 1 * H },
  { id: "n3", type: "follow", icon: "👤", text: "**@crypto_lea** a commencé à te suivre", at: now - 2 * H },
  { id: "n4", type: "expire", icon: "⏳", text: "Ton post **« Mon premier post… »** expire dans **2h**", at: now - 3 * H },
  { id: "n5", type: "pump", icon: "⚡", text: "**@devSol** a pumpé ton post de **0.5 SOL**", at: now - 5 * H },
  { id: "n6", type: "comment", icon: "💬", text: "**@moon_hana** a commenté : « Bien joué ! »", at: now - 8 * H },
];

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  );
}

export default function NotificationsPage() {
  return (
    <section>
      {NOTIFS.map((n) => (
        <div key={n.id} className="notif-row">
          <div className={`notif-ico${n.type === "pump" ? " pump" : ""}`}>{n.icon}</div>
          <div className="notif-body">
            <div className="nb-text">{renderBold(n.text)}</div>
            <div className="nb-time">Il y a {timeAgo(n.at)}</div>
          </div>
        </div>
      ))}
      <p className="faint" style={{ textAlign: "center", padding: 20, fontSize: 12 }}>
        Aperçu — le flux de notifications temps réel arrive dans une phase ultérieure.
      </p>
    </section>
  );
}
