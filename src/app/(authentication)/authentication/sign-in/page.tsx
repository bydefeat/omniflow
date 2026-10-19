import { redirect } from "next/navigation";

import { SignInForm } from "@/modules/users/components/sign-in-form";
import { getHomePath, safeCallbackPath } from "@/shared/libs/role.lib";
import { getSession } from "@/shared/libs/session.lib";

export default async function SignInPage({
  searchParams,
}: PageProps<"/authentication/sign-in">) {
  const session = await getSession();
  if (session) redirect(getHomePath(session.user.role));

  const { callbackURL } = await searchParams;
  return <SignInForm callbackPath={safeCallbackPath(callbackURL)} />;
}
