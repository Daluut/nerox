import type { Metadata } from "next";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  confirmed: "Your email is confirmed. Sign in to continue.",
  link_expired: "That link has expired or was already used. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  return <SignInForm next={next} notice={notice ? NOTICES[notice] : undefined} />;
}
