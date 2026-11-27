# Build 286 — account and workspace clarity

Owner-authorized account access prerequisite for the outstanding Site 12 pilot
(Build 285). This candidate separates the administrator sign-in and MFA
appearance from campground operations, adds distinct sign-in choices, labels
the signed-in account, exposes authorized campground assignment names, and
adds a guarded platform operator account directory and recovery links.

No grants, passwords, MFA factors, original database or tenant data are changed.
The directory is read-only: administrative creation, suspension and assignment
mutations need a separately reviewed audited workflow and independent owner
approval. No platform operator may read guest records via this directory.

Verify the three entry routes, ordinary and elevated session labels, existing
MFA verification without key recreation, direct directory authorization, and
the correct campground assignment. A live authenticated role journey is not
claimed from CI or a preview alone. Preserve Meadow for tenants.
