"use client";

export function PrintButton() {
  return (
    <button
      className="primary-button print-document__button"
      type="button"
      onClick={() => window.print()}
    >
      Print reservation documents
    </button>
  );
}
