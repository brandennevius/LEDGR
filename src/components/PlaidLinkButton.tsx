"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type LinkTokenResponse = {
  link_token: string;
};

type PlaidLinkButtonProps = {
  mode?: "create" | "update";
  itemId?: string;
  label?: string;
  className?: string;
  onLinked?: () => void;
};

export default function PlaidLinkButton({
  mode = "create",
  itemId,
  label = "Connect accounts",
  className,
  onLinked,
}: PlaidLinkButtonProps) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const createLinkToken = async () => {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          itemId,
        }),
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
  }, [mode, itemId]);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setStatus("Linking accounts...");
      if (mode === "create") {
        await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
      }
      await fetch("/api/plaid/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await fetch("/api/plaid/transactions/sync", { method: "POST" });
      setStatus(mode === "update" ? "Connection updated" : "Accounts linked");
      onLinked?.();
    },
    [mode, itemId, onLinked]
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => open()}
        disabled={!ready}
        className={
          className ??
          "rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        }
      >
        {label}
      </button>
      {status ? (
        <span className="text-xs text-[color:var(--ink-soft)]">{status}</span>
      ) : null}
    </div>
  );
}
