import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileView } from "@/modules/users/components/profile-view";
import { getUserProfile } from "@/modules/users/users.query";
import { requireSession } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function ProfilePage() {
  const { user } = await requireSession();
  const profile = await getUserProfile(user.id);
  if (!profile) notFound();
  return <ProfileView profile={profile} />;
}
