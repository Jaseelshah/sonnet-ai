"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-8 h-8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2.25l7.5 3v6c0 4.556-3.075 8.608-7.5 9.75C7.575 19.858 4.5 15.806 4.5 11.25v-6L12 2.25z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4 text-gray-500"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4 text-gray-500"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // On mount, redirect to dashboard if already authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.authenticated) {
          router.push("/");
          return;
        }
      } catch {
        // Not authenticated — show login form
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/");
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show nothing while we check existing session to avoid flash
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FFB2]" />
          </span>
          <span className="text-sm">Checking session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      {/* Subtle radial glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,255,178,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00FFB2]/10 border border-[#00FFB2]/20 text-[#00FFB2] mb-4">
            <ShieldIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">
            Sonnet AI
          </h1>
          <p className="text-sm text-gray-500 mt-1 tracking-wide">
            SOC Dashboard Login
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 shadow-2xl backdrop-blur-sm">
          {/* Status line */}
          <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-[#00FFB2]/5 border border-[#00FFB2]/10">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FFB2]" />
            </span>
            <span className="text-xs text-[#00FFB2] font-medium">
              System Online — Secure Access Required
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sonnet-ai.com"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg pl-10 pr-4 py-3 text-sm transition-colors focus:outline-none focus:border-[#00FFB2] focus:ring-1 focus:ring-[#00FFB2]/40"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg pl-10 pr-4 py-3 text-sm transition-colors focus:outline-none focus:border-[#00FFB2] focus:ring-1 focus:ring-[#00FFB2]/40"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#00FFB2] hover:bg-[#00e6a0] active:bg-[#00cc8f] text-black font-semibold rounded-lg py-3 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-700 mt-6 tracking-wide">
          SONNET AI &mdash; AUTONOMOUS SOC PLATFORM &mdash; v1.0.0
        </p>
      </div>
    </div>
  );
}
