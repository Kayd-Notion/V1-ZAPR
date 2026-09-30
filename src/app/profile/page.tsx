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
      <ZaprEmpty title="No wallet, no profile.">
        <button
          className="btn btn-primary"
          onClick={() => openConnect("Connect your wallet to see your profile.")}
        >
          Connect
        </button>
      </ZaprEmpty>
    );
  }

  return <ProfileView handle={user.handle} />;
}
