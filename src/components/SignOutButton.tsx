"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/auth/signout");
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={className}
      disabled={loading}
    >
      Sign out
    </button>
  );
}
