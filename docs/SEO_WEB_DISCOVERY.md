# iCamp Web, Mobile, SEO & Discovery Contract

## Purpose

iCamp is one product with two web surfaces:

1. Public/guest web and mobile experiences that may eventually be intentionally discoverable.
2. Authenticated operational workspaces for staff, management, maintenance, finance, security and administration.

The application remains unhosted during the current rough-sketch phase. These rules exist now so later public hosting does not require an SEO, accessibility or information-architecture rewrite.

## Route classification

Every route must be classified before it becomes externally reachable.

### Public and potentially indexable

Examples include the future campground landing experience, campsite/cottage detail, booking discovery, public events, local interests, public policies and genuinely public help content.

An indexable route requires:
- one stable human-readable URL;
- exactly one descriptive visible H1;
- a unique page title;
- a useful unique meta description;
- a canonical URL once the production domain is selected;
- meaningful server-rendered text and links;
- crawlable navigation where discovery is intended;
- accurate image alternative text and intrinsic dimensions;
- mobile-first responsive rendering;
- accessible keyboard/focus behavior;
- appropriate Open Graph/social metadata;
- sitemap inclusion only after deliberate publication.

### Internal/authenticated and never indexable

/workspaces/**, authentication flows, account administration, internal diagnostics and privileged operational records must never become search landing pages.

The workspace and authentication route trees emit noindex metadata. Authorization remains the security boundary; robots directives are only a discovery/privacy signal and are never treated as access control.

## Heading contract

- Each page has exactly one H1 describing the page itself.
- Major page regions use H2.
- Cards or records inside a region normally use H3.
- Heading levels describe structure, not typography.
- Do not use a logo, repeated chrome label or build number as the page H1.
- Build numbers remain implementation provenance, not public information architecture.

## Metadata contract

Public pages require:
- concise unique title;
- unique description written for that page;
- canonical URL;
- Open Graph title/description/image when a suitable public image exists;
- index/follow only when publication is deliberate;
- language/locale matching rendered content.

Avoid keyword stuffing and duplicated boilerplate metadata.

## URL and canonical rules

- Prefer stable descriptive slugs over database IDs in public URLs.
- IDs may remain internal route/query parameters.
- Renamed public entities need redirects rather than duplicate URLs.
- Filter/query combinations must not create uncontrolled indexable duplicates.
- Canonicals are emitted only after a real production domain exists.
- Multi-campground SaaS pages must canonicalize to the correct campground/tenant.

## Robots and sitemap

When hosted public indexing is activated:
- provide robots.txt;
- provide generated XML sitemap output containing only published public routes;
- exclude authenticated workspaces, auth/account routes, internal APIs and private media;
- exclude draft, inactive, archived and unpublished records;
- partition sitemaps later if route volume warrants it.

## Structured data

Structured data must match visible authoritative page facts. Candidate schemas include campground/lodging/local-business organization information, BreadcrumbList, Event and truthful offer/rate information.

Never mark internal operations, unverified reviews, hidden pricing or draft content as public structured data.

## Public accommodation and amenity content

Future public campsite/cottage/amenity pages should consume canonical iCamp records instead of creating a separate SEO copy database.

Potential public facts include accommodation/facility type, services, occupancy once authoritative, accessibility, public gallery imagery, nearby public amenities, booking availability/rates once authoritative and public event/local-interest context.

Build 029 public_candidate is not publication. It only records operator readiness for a later public publishing workflow.

## Images

- Informative public images require accurate alternative text.
- Decorative images use empty alt text.
- Preserve width/height or aspect ratio to reduce layout shift.
- Serve responsive/optimized variants.
- Internal maintenance/security/damage evidence must never leak into public image discovery or social metadata.

## Mobile/PWA

Discovery readiness must remain mobile-first:
- responsive hierarchy;
- appropriate touch targets;
- no hover-only essential actions;
- meaningful content without requiring installation;
- progressive enhancement around PWA/offline behavior;
- server-rendered public discovery content where practical.

## Performance

Public pages should protect Core Web Vitals by limiting blocking client JavaScript, optimizing hero/gallery media, preventing layout shift, safely caching public data and minimizing third-party scripts.

## Accessibility and SEO overlap

Semantic landmarks, descriptive links, labels, headings, alt text and readable server-rendered content benefit accessibility and discovery. Accessibility remains required even for noindex internal workspaces.

## Local discovery

When real campgrounds use iCamp, public campground pages should support accurate campground/business name, address/region, contact information, seasonal/open information, public amenities, location context and event/local-interest content.

Never fabricate ratings, reviews, availability, prices or geographic claims.

## Security, privacy and crawling

SEO must never weaken security:
- authentication/authorization protect internal routes even if crawlers ignore robots;
- personal guest/staff information is never exposed for discovery;
- internal IDs and private storage paths are not intentionally indexed;
- public and internal/confidential media remain distinct;
- diagnostics and error pages must not disclose secrets or sensitive data.

## Analytics, consent and measurement

When public hosting is selected, choose privacy-conscious analytics and consent behavior appropriate to the jurisdictions served. Search-engine verification, analytics and conversion measurement are deployment tasks, not prerequisites for current unhosted development.

## Future activation checklist

Before public indexing is enabled:
1. choose the production domain/runtime;
2. establish canonical URL generation;
3. implement robots.txt and XML sitemap generation;
4. audit public routes for one H1 and unique metadata;
5. verify noindex on authenticated/internal surfaces;
6. validate structured data against visible facts;
7. verify public/private media separation;
8. run mobile, accessibility and performance checks;
9. configure search-engine ownership/monitoring;
10. monitor 404s, redirects, duplicate canonicals and crawl errors after launch.
