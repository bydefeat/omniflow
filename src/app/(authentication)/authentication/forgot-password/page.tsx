import type { Metadata } from "next";
import { connection } from "next/server";

import { ForgotPasswordForm } from "@/modules/users/components/forgot-password-form";
import { isMailConfigured } from "@/shared/libs/mail.lib";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default async function ForgotPasswordPage() {
  await connection();
  return <ForgotPasswordForm available={isMailConfigured || process.env.NODE_ENV !== "production"} />;
}
