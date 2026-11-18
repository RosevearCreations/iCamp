/** Build 262: discoverable templates, not automatically created rental inventory.
 * Only individually registered, operational campground assets may be published. */
export const RENTAL_CATEGORIES262 = Object.freeze([
  Object.freeze({ id: "pedal-boats", title: "Pedal & paddle boats", group: "Water", kind: "equipment", assetType: "watercraft", examples: "Pedal boats, paddle boats, rowboats", guidance: "Waterfront staff check, passenger limits, approved life jackets and weather restrictions required." }),
  Object.freeze({ id: "kayaks-canoes", title: "Kayaks, canoes & SUPs", group: "Water", kind: "equipment", assetType: "watercraft", examples: "Kayaks, tandem kayaks, canoes, stand-up paddleboards", guidance: "Confirm water conditions, paddles, fitted PFDs and rescue arrangements with staff." }),
  Object.freeze({ id: "boats-fishing", title: "Fishing & powered craft", group: "Water", kind: "equipment", assetType: "watercraft", examples: "Fishing boats, small motorboats, sailboats", guidance: "Operator qualification, local waterway rules, insurance and on-site waterfront supervision must be checked." }),
  Object.freeze({ id: "bikes", title: "Bicycles & mobility recreation", group: "Land", kind: "equipment", assetType: "other", examples: "Adult bikes, children's bikes, e-bikes, trikes, scooters", guidance: "Verify brakes, helmets, route suitability, age restrictions and individual asset condition." }),
  Object.freeze({ id: "carts", title: "Carts & mobility vehicles", group: "Land", kind: "equipment", assetType: "cart", examples: "Pull carts, wagons, utility carts, golf carts", guidance: "For motorized carts verify permitted drivers, insurance, operating boundaries and safety inspection." }),
  Object.freeze({ id: "camping-gear", title: "Camping equipment", group: "Camping", kind: "equipment", assetType: "other", examples: "Tents, shelters, sleeping bags, camp chairs, coolers, lanterns", guidance: "Record item condition, hygiene, fire-safe use and return inspection before handover." }),
  Object.freeze({ id: "power-cooking", title: "Outdoor cooking & power", group: "Camping", kind: "equipment", assetType: "other", examples: "Portable grills, propane cooking sets, generators, battery packs", guidance: "Staff must check fire rules, carbon monoxide, ventilation, fuels and required training." }),
  Object.freeze({ id: "kites-games", title: "Kites & outdoor games", group: "Recreation", kind: "equipment", assetType: "other", examples: "Kites, lawn games, badminton, volleyball, disc golf, sports kits", guidance: "Check open space, wind, overhead wires, age suitability and safe return of all pieces." }),
  Object.freeze({ id: "fishing-beach", title: "Fishing & beach kits", group: "Recreation", kind: "equipment", assetType: "other", examples: "Fishing rods, tackle, umbrellas, beach chairs, sand toys", guidance: "Verify fishing licences where required, sharps safety and beach access rules." }),
  Object.freeze({ id: "winter", title: "Winter recreation equipment", group: "Seasons", kind: "equipment", assetType: "other", examples: "Snowshoes, sleds, ice skates, cross-country skis", guidance: "Confirm trail and ice conditions, weather, proper sizing and qualified supervision." }),
  Object.freeze({ id: "accessibility", title: "Accessible recreation aids", group: "Access", kind: "equipment", assetType: "other", examples: "Beach wheelchairs, accessible carts, mobility aids", guidance: "Verify fit, accessible route, appropriate assistance and specialist equipment readiness." }),
  Object.freeze({ id: "equestrian", title: "Guided horseback experiences", group: "Guided activities", kind: "facility", assetType: "other", examples: "Supervised horseback riding, pony walks, equine programs", guidance: "ANIMAL / GUIDED SERVICE ONLY: never unattended equipment rental. Require qualified staff, horse welfare checks, participant screening, helmets, insurance and site-specific consent before any activity. This catalog is planning-only." }),
  Object.freeze({ id: "activity-spaces", title: "Activity areas & facilities", group: "Facilities", kind: "facility", assetType: "other", examples: "Sports courts, community halls, event shelters, guided program spaces", guidance: "Verify active facility, supervision, capacity and any site-specific safety rules." }),
  Object.freeze({ id: "custom", title: "Other campground rentals", group: "Other", kind: "equipment", assetType: "other", examples: "Any separately registered specialty equipment a campground genuinely maintains", guidance: "Staff must assess suitability, safety, availability and return rules for the actual item." }),
]);

export function rentalTemplates262(kind, assetType) {
  return RENTAL_CATEGORIES262.filter(
    (item) => item.kind === kind && (item.assetType === assetType || assetType === "other"),
  );
}

export function findRentalTemplate262(id) {
  return RENTAL_CATEGORIES262.find((item) => item.id === id) ?? null;
}
