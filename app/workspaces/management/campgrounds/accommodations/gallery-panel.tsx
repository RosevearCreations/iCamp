/* eslint-disable @next/next/no-img-element */

import { SectionHeading } from "@/components/section-heading";
import type { AccommodationGalleryImage } from "@/lib/gallery/postgres.mjs";

import {
  archiveAccommodationGalleryImageAction,
  updateAccommodationGalleryImageAction,
} from "./actions";
import styles from "./accommodation-admin.module.css";
import { GalleryUploadForm } from "./gallery-upload-form";

export function GalleryPanel({
  campgroundId,
  accommodationId,
  canManage,
  images,
}: Readonly<{
  campgroundId: string;
  accommodationId: string;
  canManage: boolean;
  images: AccommodationGalleryImage[];
}>) {
  const hero = images.find((image) => image.isHero) ?? images[0] ?? null;

  return (
    <section className={styles.galleryPanel} aria-label="Public gallery">
      <SectionHeading
        eyebrow="Build 028"
        title="Public site / cottage gallery"
        id={"public-gallery-" + accommodationId}
        helpTopic="accommodation.gallery"
      />

      <div className={styles.gallerySummary}>
        <div>
          <strong>{images.length} / 10</strong>
          <span>Active public images</span>
        </div>
        <div>
          <strong>{hero ? "Ready" : "Not set"}</strong>
          <span>Hero image</span>
        </div>
        <div>
          <strong>3</strong>
          <span>Delivery variants per image</span>
        </div>
      </div>

      {hero ? (
        <div className={styles.galleryHero}>
          {hero.optimizedUrl ?? hero.sourceUrl ? (
            <img
              src={hero.optimizedUrl ?? hero.sourceUrl ?? undefined}
              alt={hero.altText}
              width={hero.optimizedWidth}
              height={hero.optimizedHeight}
            />
          ) : (
            <div className={styles.galleryPlaceholder}>
              Storage URL unavailable in this environment
            </div>
          )}
          <div>
            <span className={styles.statusPill}>Hero</span>
            <strong>{hero.caption ?? hero.altText}</strong>
            <small>
              {hero.sourceWidth} × {hero.sourceHeight} source · optimized{" "}
              {hero.optimizedWidth} × {hero.optimizedHeight}
            </small>
          </div>
        </div>
      ) : (
        <p className={styles.empty}>
          No public images yet. Add a real campsite or cottage image below.
        </p>
      )}

      {images.length > 0 ? (
        <div className={styles.galleryGrid}>
          {images.map((image) => (
            <article className={styles.galleryCard} key={image.id}>
              {image.thumbnailUrl ?? image.sourceUrl ? (
                <img
                  src={image.thumbnailUrl ?? image.sourceUrl ?? undefined}
                  alt={image.altText}
                  width={image.thumbnailWidth}
                  height={image.thumbnailHeight}
                />
              ) : (
                <div className={styles.galleryPlaceholder}>Image unavailable</div>
              )}

              <div className={styles.galleryCardHeader}>
                <strong>
                  {image.isHero ? "Hero" : "Gallery"} · position {image.sortOrder}
                </strong>
                <small>{image.caption ?? "No caption"}</small>
              </div>

              {canManage ? (
                <>
                  <form
                    action={updateAccommodationGalleryImageAction}
                    className={styles.galleryMetaForm}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="galleryImageId"
                      value={image.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={image.rowVersion}
                    />

                    <label className={styles.field}>
                      <span>Order</span>
                      <input
                        type="number"
                        name="sortOrder"
                        min={1}
                        max={10}
                        defaultValue={image.sortOrder}
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Alternative text</span>
                      <input
                        name="altText"
                        maxLength={240}
                        defaultValue={image.altText}
                        required
                      />
                    </label>

                    <label className={styles.fieldWide}>
                      <span>Caption</span>
                      <textarea
                        name="caption"
                        maxLength={300}
                        defaultValue={image.caption ?? ""}
                      />
                    </label>

                    {!image.isHero ? (
                      <label className={styles.inlineCheck}>
                        <input type="checkbox" name="makeHero" />
                        Make this the hero image
                      </label>
                    ) : (
                      <span className={styles.statusPill}>Current hero</span>
                    )}

                    <button className="primary-button" type="submit">
                      Save gallery details
                    </button>
                  </form>

                  <form action={archiveAccommodationGalleryImageAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="galleryImageId"
                      value={image.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={image.rowVersion}
                    />
                    <button className="secondary-button" type="submit">
                      Remove from public gallery
                    </button>
                  </form>
                </>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <GalleryUploadForm
          campgroundId={campgroundId}
          accommodationId={accommodationId}
          imageCount={images.length}
        />
      ) : null}

      <p className={styles.boundary}>
        Public accommodation photography is intentionally separate from
        internal maintenance, housekeeping and damage evidence. Build 038 can
        reuse this published gallery in the guest booking/detail experience
        without exposing operational media.
      </p>
    </section>
  );
}
