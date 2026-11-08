import { normalizePublicBookingMapFilters } from "./core.mjs";
import { normalizePublicDiscoveryFilters } from "./discovery.mjs";

function realCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Parse public query values before any live inventory query. Never guess missing availability. */
export function parsePublicBookingSearch(params = {}, defaults = {}) {
  const input = {
    ...params,
    arrivalDate: params.arrivalDate ?? defaults.arrivalDate,
    departureDate: params.departureDate ?? defaults.departureDate,
  };
  try {
    const mapFilters = normalizePublicBookingMapFilters(input);
    if (
      !realCalendarDate(mapFilters.arrivalDate) ||
      !realCalendarDate(mapFilters.departureDate)
    ) {
      return Object.freeze({
        ok: false,
        message: "Enter real arrival and departure calendar dates.",
      });
    }
    const discoveryFilters = normalizePublicDiscoveryFilters(input);
    return Object.freeze({ ok: true, mapFilters, discoveryFilters });
  } catch (error) {
    const dateError = /arrival|departure|ISO dates/i.test(
      String(error?.message),
    );
    return Object.freeze({
      ok: false,
      message: dateError
        ? "Choose a valid arrival and departure date; departure must be after arrival."
        : "One or more filters are invalid. Reset the filters and try again.",
    });
  }
}
