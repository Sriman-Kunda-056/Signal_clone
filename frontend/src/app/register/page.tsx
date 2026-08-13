"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/FormField";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function RegisterPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState<"details" | "verify">("details");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("verify");
  }

  async function handleVerifySubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username.trim(), displayName.trim(), password, otp.trim());
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
            {step === "details" ? "Create your account" : "Verify your number"}
          </h1>
          <p className="text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {step === "details"
              ? "Signal Clone uses a mocked verification flow for this demo."
              : `We sent a code to verify @${username}. Enter it below to continue.`}
          </p>
        </div>

        {step === "details" ? (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            <FormField label="Username" value={username} onChange={setUsername} autoFocus />
            <FormField label="Display name" value={displayName} onChange={setDisplayName} />
            <FormField label="Password" type="password" value={password} onChange={setPassword} />
            <button
              type="submit"
              className="mt-2 rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              Send verification code
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-4">
            <FormField label="Verification code" value={otp} onChange={setOtp} autoFocus placeholder="123456" />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              This is a mocked OTP flow — use <strong>123456</strong> to continue.
            </p>

            {error && (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
            >
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              ← Back
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--color-accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
