"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type LinkTokenResponse = {
  link_token: string;
};

export default function PlaidLinkButton() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not connected");

  useEffect(() => {
    const createLinkToken = async () => {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message =
          data?.plaid?.error_message ||
          data?.error ||
          "Unable to create Plaid link token.";
        setStatus(message);
        return;
      }
      const data = (await response.json()) as LinkTokenResponse;
      setToken(data.link_token);
    };

    createLinkToken().catch(() => {
      setStatus("Unable to start Plaid");
    });
  }, []);

  const onSuccess = useCallback(async (public_token: string) => {
    setStatus("Linking accounts...");
    await fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token }),
    });
    await fetch("/api/plaid/transactions/sync", { method: "POST" });
    setStatus("Accounts linked");
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => open()}
        disabled={!ready}
        className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
      >
        Connect accounts
      </button>
      <span className="text-xs text-[color:var(--ink-soft)]">{status}</span>
    </div>
  );
}
