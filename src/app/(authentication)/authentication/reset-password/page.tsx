import { ResetPasswordForm } from "@/modules/users/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/authentication/reset-password">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && !error;
  return <ResetPasswordForm token={valid ? token : null} />;
}
