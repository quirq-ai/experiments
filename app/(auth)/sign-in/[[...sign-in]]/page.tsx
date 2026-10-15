import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { authEnabled } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      {authEnabled ? (
        <SignIn />
      ) : (
        <div className="w-[380px] rounded-lg border bg-panel p-6">
          <div className="mb-1 text-base font-semibold text-foreground">Clerk is not configured</div>
          <p className="text-sm text-muted-foreground">
            The app is running in open demo mode. To enable sign in, copy
            <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-xs">.env.example</code>
            to <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-xs">.env.local</code>
            and add your Clerk keys, then restart the dev server.
          </p>
          <Link
            href="/my-issues"
            className="mt-4 inline-flex h-7 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue to app
          </Link>
        </div>
      )}
    </div>
  );
}
