"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    // Future telemetry will report the digest/correlation reference through a
    // protected diagnostic adapter. Do not log the full error here.
  }, [error]);

  return (
    <main className="error-surface">
      <section className="error-card" role="alert">
        <p className="eyebrow">iCamp encountered a problem</p>
        <h1>That operation could not be completed.</h1>
        <p>
          No sensitive technical detail is displayed here. You can try again, or
          provide the support reference to authorized campground support.
        </p>
        {error.digest ? (
          <p className="support-reference">
            Support reference: <strong>{error.digest}</strong>
          </p>
        ) : null}
        <button className="primary-button" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
