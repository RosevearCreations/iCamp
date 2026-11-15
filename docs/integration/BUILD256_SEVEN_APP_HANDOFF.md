# Build 256 — Seven-App Original Revocation and Safe Routing Handoff

Owner-directed order: **ai-data-platform → rosevear-ai-hub → rosevear-comms-hub → iCamp → YW → devilndove → rosiedazzlers**.

Source schema `rosevear.seven-app-source-envelope.v1`, signature schema `rosevear.seven-app-signed-event.v1`, queue schema `rosevear.seven-app-revocation-handoff.v1`, release `iCamp Build 256`.

| Recipient | Relationship | Required trust | What Build 256 supplies |
| --- | --- | --- | --- |
| ai-data-platform | Top Master | Independent signed source + T0-T5 policy | Held non-sensitive revocation receipt target |
| rosevear-ai-hub | Physical host Master | Genuine host OFF custody and independent signer | Held non-sensitive revocation receipt target |
| rosevear-comms-hub | Communications Master | Consent, signer and scope checked independently | Held non-sensitive revocation receipt target |
| iCamp | Governed Slave Application Shell | Campground owner MFA, FORCE-RLS, original 3-Master source | Local immutable receipt, independent review and hold ledger |
| YW | Governed Slave Application Shell | Its own tenant roles, signing, source approval | Identity-compatible contract; no unapproved cross-tenant send |
| devilndove | Direct Master-connected brand | Its own original signer, consent, brand recipient grant | Compatible seven-app source ID; no guest/media transfer |
| rosiedazzlers | Direct Master-connected brand | Its own original signer, consent, vehicle/booking grant | Compatible seven-app source ID; no guest/media transfer |

**All Master theme instances:** use the same owner-approved Master instrument theme, independently applied in their respective repositories. **Slave themes:** iCamp Meadow/Orbit and YW independent options remain untouched. **Shell banners:** iCamp and YW must explicitly identify Slave Application Shell at runtime; Build 407 already covers the iCamp banner.

**Cross-app handshake condition:** each Master must independently validate Ed25519 original, pin freshness, source SHA, nonce, permissions, consent, outbox receipt, its actual inbound transport and authentic delivery ACK. A schema match, source-only hold queue, repo link or test fixture is not a working connection.

Never copy private signing keys, original user data, guest/vehicle/media PII or customer payment information between apps. The Build 256 outbox remains `hold_undelivered` until separately authorized communications infrastructure operates.

Production handoff must append the exact `dev` and `main` commit hashes, verified GitHub check results, Vercel READY SHA and HTTP readback from the final release.
