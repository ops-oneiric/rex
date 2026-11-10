import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { isAuthenticated } from "@/lib/auth/dal";
import { safeRedirectPath } from "@/lib/auth/policy";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(Array.isArray(next) ? next[0] : next);
  if (await isAuthenticated()) redirect(nextPath);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="glass p-7">
          <h1 className="text-lg font-semibold text-rex-950">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-ink-muted">Enter your admin credentials to continue.</p>
          <LoginForm next={nextPath} />
        </div>
      </div>
    </main>
  );
}
