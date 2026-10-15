/*
  Clerk is enabled when a publishable key is present. Without keys the app
  runs in open demo mode: no route protection, a static user chip in the
  sidebar, and the sign-in page shows setup instructions.
  NEXT_PUBLIC_ vars are inlined at build time, so this is safe on client
  and server alike.
*/
export const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
