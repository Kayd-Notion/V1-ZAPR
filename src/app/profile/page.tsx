"use client";
import { ProfileView } from "@/components/ProfileView";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";

export default function MyProfilePage() {
  const { user, status } = useSession();
  const { openConnect } = useUI();

  if (status === "loading") {
    return <ZaprLoader />;
  }

  if (!user) {
    return (
      <ZaprEmpty title="Pas de wallet, pas de profil.">
        <button
          className="btn btn-primary"
          onClick={() => openConnect("Connecte ton wallet pour accéder à ton profil.")}
        >
          Connecter
        </button>
      </ZaprEmpty>
    );
  }

  return <ProfileView handle={user.handle} />;
}
