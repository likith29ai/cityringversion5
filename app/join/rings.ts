// Shared Ring (a.k.a. `groups` row) type + pure filtering helpers.
// Kept free of React/Supabase imports so the logic is easy to test.

export type Ring = {
  id: string;
  title: string;
  city: string;
  interest: string;
  description: string;
  platforms: string[];
  poster_url?: string | null;
  /**
   * Optional neighbourhood, e.g. "Koramangala". Requires an `area` text column on
   * the `groups` table (see supabase/add_area_to_groups.sql). When the column is
   * missing or empty the Area filter is shown disabled.
   */
  area?: string | null;
};

export const ALL = "All";

export type RingFilters = {
  interest: string;
  city: string;
  area: string;
  platform: string;
  search: string;
};

export const EMPTY_FILTERS: RingFilters = {
  interest: ALL,
  city: ALL,
  area: ALL,
  platform: ALL,
  search: "",
};

export function hasActiveFilters(f: RingFilters): boolean {
  return (
    f.interest !== ALL ||
    f.city !== ALL ||
    f.area !== ALL ||
    f.platform !== ALL ||
    f.search.trim() !== ""
  );
}

const clean = (s?: string | null) => (s ?? "").trim();

/** Combined filter: every active filter must match (AND). */
export function filterRings(rings: Ring[], f: RingFilters): Ring[] {
  const q = f.search.trim().toLowerCase();

  return rings.filter((g) => {
    const okInterest = f.interest === ALL || g.interest === f.interest;
    const okCity = f.city === ALL || g.city === f.city;
    const okArea = f.area === ALL || clean(g.area) === f.area;
    const okPlatform =
      f.platform === ALL ||
      (Array.isArray(g.platforms) && g.platforms.includes(f.platform));

    // Search covers Title + Description + Interest + City (+ Area)
    const okSearch =
      !q ||
      [g.title, g.description, g.interest, g.city, g.area]
        .map((v) => clean(v))
        .join(" ")
        .toLowerCase()
        .includes(q);

    return okInterest && okCity && okArea && okPlatform && okSearch;
  });
}

export type RingOptions = {
  interests: string[];
  cities: string[];
  areas: string[];
  platforms: string[];
};

const PREFERRED_PLATFORM_ORDER = ["instagram", "gmail", "whatsapp", "telegram"];

/**
 * Builds the option lists for each dropdown.
 * Areas are scoped to the selected city so you can never pick an
 * area that cannot exist in that city.
 */
export function deriveOptions(rings: Ring[], selectedCity: string): RingOptions {
  const interests = new Set<string>();
  const cities = new Set<string>();
  const areas = new Set<string>();
  const platforms = new Set<string>();

  for (const g of rings) {
    if (g.interest) interests.add(g.interest);
    if (g.city) cities.add(g.city);
    const a = clean(g.area);
    if (a && (selectedCity === ALL || g.city === selectedCity)) areas.add(a);
    for (const p of g.platforms || []) platforms.add(p);
  }

  const orderedPlatforms = PREFERRED_PLATFORM_ORDER.filter((p) => platforms.has(p));
  const restPlatforms = Array.from(platforms).filter(
    (p) => !PREFERRED_PLATFORM_ORDER.includes(p)
  );

  return {
    interests: [ALL, ...Array.from(interests)],
    cities: [ALL, ...Array.from(cities)],
    areas: [ALL, ...Array.from(areas).sort((a, b) => a.localeCompare(b))],
    platforms: [ALL, ...orderedPlatforms, ...restPlatforms],
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  gmail: "Gmail",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

export function platformLabel(p: string): string {
  if (PLATFORM_LABELS[p]) return PLATFORM_LABELS[p];
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : p;
}

export function ringLocation(r: Ring): string {
  const a = clean(r.area);
  return a ? `${r.city}, ${a}` : r.city;
}
