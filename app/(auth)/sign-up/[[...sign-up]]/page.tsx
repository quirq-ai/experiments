import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { authEnabled } from "@/lib/auth";

export default function SignUpPage() {
  if (!authEnabled) redirect("/sign-in");
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <SignUp />
    </div>
  );
}
