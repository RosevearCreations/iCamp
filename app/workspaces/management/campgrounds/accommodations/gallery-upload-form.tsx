"use client";

import { useState, type FormEvent } from "react";

import { uploadAccommodationGalleryImageAction } from "./actions";
import styles from "./accommodation-admin.module.css";

async function canvasBlob(
  source: File,
  maxDimension: number,
  quality: number,
  suffix: string,
) {
  const bitmap = await createImageBitmap(source);

  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("This browser cannot prepare gallery images.");
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Gallery image conversion failed.")),
        "image/webp",
        quality,
      );
    });

    const stem = source.name.replace(/\.[^.]+$/u, "") || "gallery-image";
    return new File([blob], `${stem}-${suffix}.webp`, {
      type: "image/webp",
    });
  } finally {
    bitmap.close();
  }
}

export function GalleryUploadForm({
  campgroundId,
  accommodationId,
  imageCount,
}: Readonly<{
  campgroundId: string;
  accommodationId: string;
  imageCount: number;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = imageCount >= 10;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (full) {
      setError("This accommodation already has 10 active public images.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const source = formData.get("sourceImage");

    if (!(source instanceof File) || source.size < 1) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }

    setBusy(true);

    try {
      const [thumbnail, optimized] = await Promise.all([
        canvasBlob(source, 360, 0.78, "thumbnail"),
        canvasBlob(source, 1440, 0.84, "optimized"),
      ]);

      formData.set("thumbnailImage", thumbnail);
      formData.set("optimizedImage", optimized);
      await uploadAccommodationGalleryImageAction(formData);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The gallery image could not be prepared.",
      );
      setBusy(false);
    }
  }

  return (
    <form className={styles.galleryUpload} onSubmit={submit}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="accommodationId" value={accommodationId} />

      <label className={styles.field}>
        <span>Public image</span>
        <input
          type="file"
          name="sourceImage"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy || full}
        />
      </label>

      <label className={styles.field}>
        <span>Alternative text</span>
        <input
          name="altText"
          maxLength={240}
          placeholder="Describe what a guest needs to know from the image"
          required
          disabled={busy || full}
        />
      </label>

      <label className={styles.fieldWide}>
        <span>Caption (optional)</span>
        <textarea
          name="caption"
          maxLength={300}
          placeholder="Short public-facing caption"
          disabled={busy || full}
        />
      </label>

      <div className={styles.galleryUploadFooter}>
        <small>
          {full
            ? "10 / 10 active public images"
            : `${imageCount} / 10 active public images · thumbnail and optimized WebP variants are prepared before upload`}
        </small>
        <button className="primary-button" type="submit" disabled={busy || full}>
          {busy ? "Preparing images…" : "Add public image"}
        </button>
      </div>

      {error ? <p className={styles.galleryError}>{error}</p> : null}
    </form>
  );
}
