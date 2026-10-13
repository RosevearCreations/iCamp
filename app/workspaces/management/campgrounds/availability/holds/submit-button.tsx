"use client";

import { useFormStatus } from "react-dom";

export function HoldSubmitButton({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
}) {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? pending : idle}
    </button>
  );
}
