import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[color:var(--ink-soft)]">
          Loading...
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
