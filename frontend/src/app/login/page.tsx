"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/FormField";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--color-app-bg)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--color-accent)" }}
          >
            <MessageCircle className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Sign in
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Welcome back to Signal Clone
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Username" value={username} onChange={setUsername} autoFocus />
          <FormField label="Password" type="password" value={password} onChange={setPassword} />

          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium" style={{ color: "var(--color-accent)" }}>
            Register
          </Link>
        </p>

        <div
          className="mt-6 rounded-lg border p-3 text-xs leading-relaxed"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          Demo accounts: <strong>rajini</strong>, <strong>kamal</strong>, <strong>prabhas</strong>,{" "}
          <strong>vijay</strong>, <strong>dhanush</strong>, <strong>allu</strong> — password{" "}
          <strong>password123</strong>
        </div>
      </div>
    </main>
  );
}
