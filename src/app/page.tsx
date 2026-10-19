import { redirect } from "next/navigation";

import { getHomePath } from "@/shared/libs/role.lib";
import { requireSession } from "@/shared/libs/session.lib";

export default async function Home() {
  const session = await requireSession();
  redirect(getHomePath(session.user.role));
}
