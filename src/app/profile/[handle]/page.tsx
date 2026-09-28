"use client";
import { use } from "react";
import { ProfileView } from "@/components/ProfileView";

export default function ProfileHandlePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  return <ProfileView handle={handle} />;
}
