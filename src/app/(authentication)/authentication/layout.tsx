import { AuthenticationLayout } from "@/shared/components/layouts/authentication";

export default function Layout({ children }: LayoutProps<"/authentication">) {
  return <AuthenticationLayout>{children}</AuthenticationLayout>;
}
