"use client";
import { ProfileView } from "@/components/ProfileView";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";

export default function MyProfilePage() {
  const { user, status } = useSession();
  const { openConnect } = useUI();

  if (status === "loading") {
    return (
      <div className="loading-state">
        <span className="spinner" style={{ color: "var(--accent)" }} /> …
      </div>
    );
  }

  if (!user) {
    return (
      <div className="empty-state">
        <div className="ico">👤</div>
        <p>Connecte ton wallet pour voir ton profil.</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 14 }}
          onClick={() => openConnect("Connecte ton wallet pour accéder à ton profil.")}
        >
          Connecter
        </button>
      </div>
    );
  }

  return <ProfileView handle={user.handle} />;
}
