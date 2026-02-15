import { Suspense } from "react";
import MfaSetupClient from "@/components/MfaSetupClient";

export const dynamic = "force-dynamic";

export default function MfaSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[color:var(--ink-soft)]">
          Loading...
        </div>
      }
    >
      <MfaSetupClient />
    </Suspense>
  );
}
