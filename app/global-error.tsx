"use client";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <html lang="en">
      <body>
        <main className="error-surface">
          <section className="error-card" role="alert">
            <p>iCamp encountered a system error.</p>
            <h1>The application could not complete this request.</h1>
            <p>
              Please try again. If the problem continues, provide the support
              reference to authorized campground support.
            </p>
            {error.digest ? (
              <p>
                Support reference: <strong>{error.digest}</strong>
              </p>
            ) : null}
            <button onClick={reset} type="button">
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
