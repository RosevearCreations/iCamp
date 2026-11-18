"use client";

import { useState } from "react";

import {
  rentalTemplates262,
  type RentalTemplate262,
} from "@/lib/rental-planner/catalog262.mjs";

export function RentalTemplatePicker262({
  assetClass,
  assetType,
}: Readonly<{ assetClass: string; assetType: string }>) {
  const [selected, setSelected] = useState("");
  const available = rentalTemplates262(assetClass, assetType);
  const selectedTemplate = available.find((item) => item.id === selected);
  return (
    <fieldset className="rental-template262">
      <legend>Build 262 · Rental description starter</legend>
      <p>
        Pick a template for an existing registered asset. This fills editable
        description and safety guidance; it never creates equipment or publishes
        a listing. Match the real item and check permissions before saving.
      </p>
      <label>
        Rental item / supervised activity
        <select
          aria-label="Rental setup template"
          value={selected}
          onChange={(event) => {
            const id = event.target.value;
            setSelected(id);
            const template = available.find((item) => item.id === id);
            const form = event.currentTarget.closest("form");
            if (!form || !template) return;
            const description = form.querySelector<HTMLTextAreaElement>(
              'textarea[name="description"]',
            );
            const guidance = form.querySelector<HTMLTextAreaElement>(
              'textarea[name="returnGuidance"]',
            );
            if (description)
              description.value = `Staff-reviewed ${template.title.toLowerCase()}: ${template.examples}. Confirm actual registered inventory and dates with staff.`;
            if (guidance) guidance.value = template.guidance.slice(0, 500);
          }}
        >
          <option value="">Select an optional starter</option>
          {available.map((template: RentalTemplate262) => (
            <option value={template.id} key={template.id}>
              {template.title}
            </option>
          ))}
        </select>
      </label>
      {selectedTemplate ? (
        <p role="status">
          <strong>Staff review:</strong> {selectedTemplate.guidance}
        </p>
      ) : null}
    </fieldset>
  );
}
