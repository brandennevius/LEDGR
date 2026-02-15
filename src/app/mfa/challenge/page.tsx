import { Suspense } from "react";
import MfaChallengeClient from "@/components/MfaChallengeClient";

export const dynamic = "force-dynamic";

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[color:var(--ink-soft)]">
          Loading...
        </div>
      }
    >
      <MfaChallengeClient />
    </Suspense>
  );
}
