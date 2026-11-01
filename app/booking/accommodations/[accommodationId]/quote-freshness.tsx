"use client";

import { useEffect, useState } from "react";

export function QuoteFreshness({ expiresAt }: Readonly<{ expiresAt: string }>) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setExpired(Date.now() >= Date.parse(expiresAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  return (
    <p role="status" aria-live="polite">
      {expired ? (
        <strong>
          Quote expired. Refresh to obtain current rates, policies and
          availability.
        </strong>
      ) : (
        "This preview expires after 10 minutes. A checkout or later visit will reprice it."
      )}{" "}
      <button type="button" onClick={() => window.location.reload()}>
        Refresh live quote
      </button>
    </p>
  );
}

export function QuotePrintButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Print this current preview
    </button>
  );
}
