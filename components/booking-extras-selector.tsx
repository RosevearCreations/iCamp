"use client";

import { useMemo, useState } from "react";

import { quoteBookingCharges } from "@/lib/booking-charges/core.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

type Extra = {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  priceLabel: string;
  pricingBasis: "per_stay" | "per_night" | "per_unit" | "percent_of_stay";
  unitPriceCents: number | null;
  percentageBasisPoints: number | null;
  currencyCode: string;
  minimumQuantity: number;
  maximumQuantity: number;
};

type Selection = { code: string; quantity: number };

export function BookingExtrasSelector({
  items,
  initialSelections,
  nights,
  staySubtotalCents,
  automaticTotalCents,
  currencyCode,
}: Readonly<{
  items: Extra[];
  initialSelections: Selection[];
  nights: number;
  staySubtotalCents: number;
  automaticTotalCents: number;
  currencyCode: string;
}>) {
  const [selected, setSelected] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialSelections
        .filter((selection) =>
          items.some((item) => item.code === selection.code),
        )
        .map((selection) => [selection.code, selection.quantity]),
    ),
  );

  const preview = useMemo(() => {
    try {
      const catalog = items.map((item) => ({
        ...item,
        scopeKind: "campground",
        chargeKind: "add_on",
        applicationMode: "optional",
        isActive: true,
      }));
      return quoteBookingCharges({
        catalog,
        selections: Object.entries(selected).map(([code, quantity]) => ({
          code,
          quantity,
        })),
        nights,
        staySubtotalCents,
        currencyCode,
      });
    } catch {
      return null;
    }
  }, [items, selected, nights, staySubtotalCents, currencyCode]);

  return (
    <div data-booking-extras="build234">
      <p>
        These services are available for the entire selected stay. Select the
        quantity we need; the estimate updates immediately and will be priced
        again by the server before a reservation is created.
      </p>
      {items.length ? (
        <div className="form-grid">
          {items.map((item) => (
            <div key={item.code} className="content-panel">
              <label>
                <input
                  name="chargeCode"
                  type="checkbox"
                  value={item.code}
                  checked={Object.hasOwn(selected, item.code)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = { ...current };
                      if (event.target.checked)
                        next[item.code] = item.minimumQuantity;
                      else delete next[item.code];
                      return next;
                    })
                  }
                />{" "}
                <strong>{item.displayName}</strong> · {item.priceLabel}
              </label>
              <label>
                <span>Quantity (maximum {item.maximumQuantity})</span>
                <input
                  name={`quantity__${item.code}`}
                  type="number"
                  min={item.minimumQuantity}
                  max={item.maximumQuantity}
                  step={1}
                  required={Object.hasOwn(selected, item.code)}
                  disabled={!Object.hasOwn(selected, item.code)}
                  value={selected[item.code] ?? item.minimumQuantity}
                  onChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [item.code]: Number(event.target.value),
                    }))
                  }
                />
              </label>
              {item.description ? <p>{item.description}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p>No optional services or passes are available for these dates.</p>
      )}
      <div className="content-panel" aria-live="polite" aria-atomic="true">
        <h3>Updated booking estimate</h3>
        {preview ? (
          <>
            <p>Accommodation: {formatMoney(staySubtotalCents, currencyCode)}</p>
            <p>
              Automatic fees: {formatMoney(automaticTotalCents, currencyCode)}
            </p>
            {preview.lines.map((line) => (
              <p key={line.code}>
                {line.displayName} × {line.quantity}:{" "}
                {formatMoney(line.lineTotalCents, currencyCode)}
              </p>
            ))}
            <p>
              <strong>
                Known subtotal:{" "}
                {formatMoney(
                  staySubtotalCents +
                    automaticTotalCents +
                    preview.optionalTotalCents,
                  currencyCode,
                )}
              </strong>
            </p>
          </>
        ) : (
          <p role="alert">Review quantities before continuing.</p>
        )}
        <p>
          This on-screen estimate uses the published rates, not a locked quote.
          Taxes are not yet configured and are not assumed to be zero. The
          server checks service availability, price, fees and the temporary hold
          again when creating the pending reservation. No payment is made here.
        </p>
      </div>
    </div>
  );
}
