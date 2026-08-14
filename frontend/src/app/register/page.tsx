"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/FormField";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// Fixed mock code, same as everywhere else in the app — real SMS delivery
// is explicitly out of scope per the assignment brief.
const MOCK_OTP = "123456";

type Step = "phone" | "verify" | "details";

export default function RegisterPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  // Signal's real registration order: phone number, then verify, then set
  // up your profile — not the other way around.
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("verify");
  }

  function handleVerifySubmit(e: FormEvent) {
    e.preventDefault();
    // The OTP is re-checked authoritatively server-side at final submission
    // (routers/auth.py) — this is just a quick UX gate so a wrong code
    // doesn't sail through to the profile step.
    if (otp.trim() !== MOCK_OTP) {
      setError("Invalid verification code");
      return;
    }
    setError(null);
    setStep("details");
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(phoneNumber.trim(), username.trim(), displayName.trim(), password, otp.trim());
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const headings: Record<Step, { title: string; subtitle: string }> = {
    phone: {
      title: "Enter your phone number",
      subtitle: "Signal Clone uses a mocked verification flow for this demo — no real SMS is sent.",
    },
    verify: {
      title: "Verify your number",
      subtitle: `We sent a code to ${phoneNumber}. Enter it below to continue.`,
    },
    details: {
      title: "Create your profile",
      subtitle: "Choose a username, display name, and password.",
    },
  };

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
            {headings[step].title}
          </h1>
          <p className="text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {headings[step].subtitle}
          </p>
        </div>

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
            <FormField
              label="Phone number"
              type="tel"
              value={phoneNumber}
              onChange={setPhoneNumber}
              autoFocus
              placeholder="+91 98765 43210"
            />
            <button
              type="submit"
              className="mt-2 rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              Send verification code
            </button>
          </form>
        )}

        {step === "verify" && (
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
              className="rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              Verify & continue
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("phone");
              }}
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              ← Back
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            <FormField label="Username" value={username} onChange={setUsername} autoFocus />
            <FormField label="Display name" value={displayName} onChange={setDisplayName} />
            <FormField label="Password" type="password" value={password} onChange={setPassword} />

            {error && (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("verify");
              }}
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
