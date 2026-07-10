import { base44 } from "@/api/base44Client";

// In-memory caches so re-opening a dropdown for the same Country/State
// doesn't re-trigger a network/LLM call within the same session.
const stateCache = new Map();
const cityCache = new Map();

const API_BASE = "https://countriesnow.space/api/v0.1";

// Primary data source: countriesnow.space — free, no API key, full (non-truncated)
// state and city lists for every country.
async function fetchStatesFromAPI(country) {
  const res = await fetch(`${API_BASE}/countries/states`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country }),
  });
  if (!res.ok) throw new Error("states request failed");
  const json = await res.json();
  if (json.error) throw new Error(json.msg || "states not found");
  return (json?.data?.states || []).map(s => s.name).filter(Boolean).sort();
}

async function fetchCitiesFromAPI(country, state) {
  const res = await fetch(`${API_BASE}/countries/state/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country, state }),
  });
  if (!res.ok) throw new Error("cities request failed");
  const json = await res.json();
  if (json.error) throw new Error(json.msg || "cities not found");
  return (json?.data || []).filter(Boolean).sort();
}

// Fallback: only used if the primary API is unreachable or doesn't recognize
// the country/state name.
async function fetchStatesViaLLM(country) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `List the official states, provinces, or top-level administrative regions of ${country}. Return only a JSON array of names, sorted alphabetically. Do not include explanations.`,
    response_json_schema: {
      type: "object",
      properties: { states: { type: "array", items: { type: "string" } } },
      required: ["states"],
    },
  });
  return result?.states || [];
}

async function fetchCitiesViaLLM(country, state) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `List all known cities and towns in ${state}, ${country}. Include smaller towns, not just major cities. Return only a JSON array of names, sorted alphabetically. Do not include explanations.`,
    response_json_schema: {
      type: "object",
      properties: { cities: { type: "array", items: { type: "string" } } },
      required: ["cities"],
    },
  });
  return result?.cities || [];
}

// Returns states/provinces/regions for a given country name.
export async function getStatesForCountry(country) {
  if (!country) return [];
  if (stateCache.has(country)) return stateCache.get(country);
  let list = [];
  try {
    list = await fetchStatesFromAPI(country);
  } catch {
    list = await fetchStatesViaLLM(country).catch(() => []);
  }
  stateCache.set(country, list);
  return list;
}

// Returns the complete list of cities/towns for a given state within a country.
export async function getCitiesForState(country, state) {
  if (!country || !state) return [];
  const key = `${country}|${state}`;
  if (cityCache.has(key)) return cityCache.get(key);
  let list = [];
  try {
    list = await fetchCitiesFromAPI(country, state);
    if (!list.length) throw new Error("empty city list");
  } catch {
    list = await fetchCitiesViaLLM(country, state).catch(() => []);
  }
  cityCache.set(key, list);
  return list;
}