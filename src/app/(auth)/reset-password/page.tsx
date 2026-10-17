import type { Metadata } from "next";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "New password" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
