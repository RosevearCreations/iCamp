"use client";

import { useEffect, useState } from "react";

import {
  createGuestReviewDraft,
  guestReviewDraftKey,
  readGuestReviewDraft,
} from "@/lib/reservation-decisions/guest-review-draft.mjs";

import styles from "./guest-review-reason.module.css";

export function GuestReviewReason({
  guestId,
  reservationId,
  kind,
  label,
  placeholder,
  clearOnSuccess,
}: Readonly<{
  guestId: string;
  reservationId: string;
  kind: "change_dates" | "cancellation_review";
  label: string;
  placeholder: string;
  clearOnSuccess: boolean;
}>) {
  const [reason, setReason] = useState("");
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = guestReviewDraftKey({ guestId, reservationId, kind });
  const inputId = `review-reason-${kind}`;

  useEffect(() => {
    try {
      if (clearOnSuccess) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      const stored = sessionStorage.getItem(storageKey);
      const draft = readGuestReviewDraft(stored);
      if (draft) {
        const timer = window.setTimeout(() => {
          setReason(draft.reason);
          setRemember(true);
          setNotice("Your unfinished reason was restored from this tab.");
        }, 0);
        return () => window.clearTimeout(timer);
      } else if (stored !== null) {
        sessionStorage.removeItem(storageKey);
        const timer = window.setTimeout(
          () => setNotice("An expired or invalid draft was discarded."),
          0,
        );
        return () => window.clearTimeout(timer);
      }
    } catch {
      const timer = window.setTimeout(
        () =>
          setNotice(
            "Private tab storage is unavailable; your text is not saved.",
          ),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [clearOnSuccess, storageKey]);

  function saveIfOptedIn(nextReason: string) {
    if (!remember) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(createGuestReviewDraft(nextReason)),
      );
      setNotice("Unfinished reason saved in this tab for up to 30 minutes.");
    } catch {
      setNotice("Private tab storage is unavailable; your text is not saved.");
    }
  }

  function changeConsent(checked: boolean) {
    setRemember(checked);
    try {
      if (checked) {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(createGuestReviewDraft(reason)),
        );
        setNotice("Unfinished reason saved in this tab for up to 30 minutes.");
      } else {
        sessionStorage.removeItem(storageKey);
        setNotice("Saved reason removed from this tab.");
      }
    } catch {
      setRemember(false);
      setNotice("Private tab storage is unavailable; your text is not saved.");
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        name="reason"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          saveIfOptedIn(event.target.value);
        }}
        minLength={10}
        maxLength={500}
        rows={3}
        required
        placeholder={placeholder}
        aria-describedby={`${inputId}-guidance`}
      />
      <p id={`${inputId}-guidance`} className={styles.guidance}>
        10–500 characters. Your reason is only sent when you deliberately submit
        a staff-review request.
      </p>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => changeConsent(event.target.checked)}
        />
        Keep this unfinished reason in this browser tab for up to 30 minutes
        (optional; do not use on a shared device).
      </label>
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {remember ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => changeConsent(false)}
        >
          Forget saved reason
        </button>
      ) : null}
    </div>
  );
}
