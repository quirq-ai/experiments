"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/logo";

function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.55 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const hasValue = email.trim().length > 0;

  function submit() {
    if (hasValue) router.push("/workspace");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-hairline-soft">
        <div className="flex h-[52px] items-center justify-between px-5">
          <Link href="/" aria-label="Autospawn home">
            <Wordmark size={17} />
          </Link>
          <Link
            href="/login"
            className="text-[12.5px] font-medium text-ink hover:text-ink-soft"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="grid flex-1 place-items-center">
        <div className="w-full max-w-[400px] px-6 pb-24">
          <h1 className="mb-8 text-center text-[26px] font-semibold tracking-tight">
            Log in to Autospawn
          </h1>

          <label
            htmlFor="login-email"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-hairline bg-card px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          />

          <button
            type="button"
            onClick={submit}
            className={`mt-3 w-full rounded-xl py-2.5 text-[13.5px] font-medium transition-colors ${
              hasValue
                ? "bg-pill-dark text-white hover:bg-black"
                : "cursor-default bg-[#a3a09b] text-white"
            }`}
          >
            Continue
          </button>

          <div className="mt-7 mb-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-[11.5px] text-ink-faint">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-hairline bg-card py-2.5 text-[13.5px] font-medium transition-colors hover:border-ink-faint"
          >
            <GoogleG size={16} />
            Continue with Google
          </button>
        </div>
      </main>
    </div>
  );
}
