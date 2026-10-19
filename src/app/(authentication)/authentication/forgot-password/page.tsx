import { ForgotPasswordForm } from "@/modules/users/components/forgot-password-form";
import { isMailConfigured } from "@/shared/libs/mail.lib";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm available={isMailConfigured || process.env.NODE_ENV !== "production"} />;
}
