"use client";

import { useState } from "react";

export function MfaPanel() {
  const [password, setPassword] = useState("");
  const [seed, setSeed] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function enroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Enrollment unavailable.");
      }
      setSeed(result.seed);
      setUri(result.setupUri);
      setPassword("");
      setMessage(
        "Add this one-time key to your authenticator app, then verify a current code.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Enrollment unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.verified) {
        throw new Error(result.error || "Verification failed.");
      }
      setSeed("");
      setUri("");
      setCode("");
      window.location.assign("/auth/account");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Verification failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-panel auth-panel">
      <h2>Set up an authenticator</h2>
      <p>
        For a new account, enter your current password to start setup. If you
        already enrolled, enter a current code below to verify this session. No
        email or SMS code is sent.
      </p>
      <form onSubmit={enroll} className="auth-form">
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <button className="secondary-button" type="submit" disabled={busy}>
          Create one-time setup key
        </button>
      </form>
      {seed ? (
        <section aria-label="Authenticator setup key">
          <p>Authenticator setup key (shown only during this enrollment):</p>
          <code>{seed}</code>
          <p>For an authenticator that accepts a setup URI:</p>
          <code style={{ overflowWrap: "anywhere" }}>{uri}</code>
          <p>
            Keep this key private. It will not be shown again after you leave
            this page.
          </p>
        </section>
      ) : null}
      <form onSubmit={verify} className="auth-form">
        <label>
          Current six-digit authenticator code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          Verify and protect session
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
