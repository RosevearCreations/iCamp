import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  feedbackCategories,
  feedbackPublicLabel,
} from "@/lib/guest-feedback/core.mjs";
import {
  listFeedbackCampgrounds,
  listPublicGuestReviews,
} from "@/lib/guest-feedback/postgres.mjs";

import styles from "../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verified campground guest reviews · iCamp",
  description:
    "Only explicitly guest-consented, staff-moderated reviews from completed stays.",
};

export default async function PublicReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    category?: string;
    rating?: string;
  }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Verified reviews are unavailable</h1>
          <p>
            The review database is not connected. No ratings or approvals can be
            verified. Please contact the campground office.
          </p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  const [campgrounds, reviews] = await Promise.all([
    listFeedbackCampgrounds(),
    listPublicGuestReviews({
      campgroundSlug: params.campground,
      category: params.category,
      rating: params.rating,
    }),
  ]);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <span>Guest reviews</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 184 · Verified completed-stay reviews</p>
          <h1>What guests chose to share</h1>
          <p className="hero-panel__lead">
            Only reviews from completed stays that guests explicitly requested
            to make public and campground staff approved appear here. Ratings
            are written by guests, never staff. Private service cases, incident
            details and guest identities are never published.
          </p>
          <div className="hero-actions">
            <Link href="/guest/feedback" className="primary-link">
              My feedback & follow-ups
            </Link>
            <Link href="/guest/stay" className="secondary-link">
              My Stay
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Guest-controlled publication"
            title="Filter approved reviews"
            id="review-filters"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.filters} role="search">
            <label>
              Campground
              <select name="campground" defaultValue={params.campground ?? ""}>
                <option value="">All campgrounds</option>
                {campgrounds.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue={params.category ?? ""}>
                <option value="">All categories</option>
                {feedbackCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rating
              <select name="rating" defaultValue={params.rating ?? ""}>
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} stars
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Filter reviews
            </button>
          </form>
        </section>
        <section className="content-panel" aria-live="polite">
          <SectionHeading
            eyebrow="Approved, guest-consented only"
            title={`${reviews.length} verified review${reviews.length === 1 ? "" : "s"}`}
            id="review-results"
            helpTopic="shell.overview"
          />
          {reviews.length === 0 ? (
            <p>
              No guest-consented, staff-approved reviews match these filters
              yet. An empty listing does not imply an absence of guest feedback.
            </p>
          ) : (
            <div className={styles.cards}>
              {reviews.map((review) => (
                <article className={styles.card} key={review.id}>
                  <p className={styles.tag}>
                    {review.campgroundName} · {review.category}
                  </p>
                  <h3>{review.title}</h3>
                  <p>
                    <strong>{feedbackPublicLabel(review)}</strong>
                  </p>
                  <p>{review.summary}</p>
                  <p>
                    Shared by a verified guest ·{" "}
                    {review.submittedAt.slice(0, 10)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
