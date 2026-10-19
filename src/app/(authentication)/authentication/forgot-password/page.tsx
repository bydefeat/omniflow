import { connection } from "next/server";

import { ForgotPasswordForm } from "@/modules/users/components/forgot-password-form";
import { isMailConfigured } from "@/shared/libs/mail.lib";

export default async function ForgotPasswordPage() {
  await connection();
  return <ForgotPasswordForm available={isMailConfigured || process.env.NODE_ENV !== "production"} />;
}
