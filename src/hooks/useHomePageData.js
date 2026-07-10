/**
 * Lazy-loading homepage data hook.
 *
 * Strategy:
 * - Hero renders immediately (no data needed)
 * - GenreRibbon (events) loads first — it's above the fold
 * - All other sections load only when their container scrolls near the viewport
 * - Module-level cache prevents refetching during the same session
 * - All independent requests within a section run in parallel (Promise.all)
 */
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// ── Session-level module cache ────────────────────────────────────────────────
// Persists across React re-renders and navigation within the session.
// Keyed so individual sections can be cached independently.
const _cache = {};
function getCached(key) { return _cache[key]; }
function setCache(key, value) { _cache[key] = value; }
export function clearHomeCache() { Object.keys(_cache).forEach(k => delete _cache[k]); }

// ── Shared loader ─────────────────────────────────────────────────────────────
async function loadEvents() {
  if (getCached("events")) return getCached("events");
  const events = await base44.entities.Event.filter({ status: "published" }, "date", 20).catch(() => []);
  setCache("events", events || []);
  return _cache["events"];
}

async function loadArtistsAndMedia() {
  if (getCached("artistsAndMedia")) return getCached("artistsAndMedia");
  const [artists, albums, posts] = await Promise.all([
    base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, null, 20).catch(() => []),
    base44.entities.ArtistAlbum.list(null, 20).catch(() => []),
    base44.entities.ArtistPost.list("-created_date", 20).catch(() => []),
  ]);
  const result = { artists: artists || [], albums: albums || [], posts: posts || [] };
  setCache("artistsAndMedia", result);
  return result;
}

async function loadMediaGallery() {
  if (getCached("mediaGallery")) return getCached("mediaGallery");
  const [mediaItems, orgPosts] = await Promise.all([
    base44.entities.MediaItem.filter({ show_on_homepage: true, status: "active", approval_status: "approved" }, "sort_order", 15).catch(() => []),
    base44.entities.OrganizerMediaPost.filter({ promote_to_front_page: true, status: "active", approval_status: "approved", is_playable: true }, "-created_date", 15).catch(() => []),
  ]);
  const result = { mediaItems: mediaItems || [], orgPosts: orgPosts || [] };
  setCache("mediaGallery", result);
  return result;
}

async function loadRafflesPolls() {
  if (getCached("rafflesPolls")) return getCached("rafflesPolls");
  const [raffles, polls] = await Promise.all([
    base44.entities.EventRaffle.filter({ status: "active" }, "-created_date", 20).catch(() => []),
    base44.entities.EventPoll.filter({ status: "active" }, "-created_date", 20).catch(() => []),
  ]);
  const result = { raffles: raffles || [], polls: polls || [] };
  setCache("rafflesPolls", result);
  return result;
}

async function loadGiveaways() {
  if (getCached("giveaways")) return getCached("giveaways");
  const giveaways = await base44.entities.Giveaway.filter({ status: "active" }, "-created_date", 20).catch(() => []);
  setCache("giveaways", giveaways || []);
  return _cache["giveaways"];
}

async function loadOrganizers() {
  if (getCached("organizers")) return getCached("organizers");
  const [organizerProfiles, listOrgRes] = await Promise.all([
    base44.entities.OrganizerProfile.list(null, 20).catch(() => []),
    base44.functions.invoke("listOrganizers", {}).catch(() => ({ data: { organizers: [] } })),
  ]);
  const result = { organizerProfiles: organizerProfiles || [], listOrgRes: listOrgRes || { data: { organizers: [] } } };
  setCache("organizers", result);
  return result;
}

// ── Per-section hooks ─────────────────────────────────────────────────────────

export function useEventsData(refreshKey = 0) {
  const [events, setEvents] = useState(getCached("events") || null);
  const [loading, setLoading] = useState(!getCached("events"));
  useEffect(() => {
    setLoading(true);
    if (getCached("events")) { setEvents(getCached("events")); setLoading(false); return; }
    loadEvents().then(e => { setEvents(e); setLoading(false); });
  }, [refreshKey]);
  return { events: events || [], loading };
}

export function useArtistsMediaData() {
  const [data, setData] = useState(getCached("artistsAndMedia") || null);
  const [loading, setLoading] = useState(!getCached("artistsAndMedia"));
  useEffect(() => {
    if (getCached("artistsAndMedia")) { setData(getCached("artistsAndMedia")); setLoading(false); return; }
    loadArtistsAndMedia().then(d => { setData(d); setLoading(false); });
  }, []);
  return { ...(data || { artists: [], albums: [], posts: [] }), loading };
}

export function useMediaGalleryData() {
  const [data, setData] = useState(getCached("mediaGallery") || null);
  const [loading, setLoading] = useState(!getCached("mediaGallery"));
  useEffect(() => {
    if (getCached("mediaGallery")) { setData(getCached("mediaGallery")); setLoading(false); return; }
    loadMediaGallery().then(d => { setData(d); setLoading(false); });
  }, []);
  return { ...(data || { mediaItems: [], orgPosts: [] }), loading };
}

export function useRafflesPollsData(refreshKey = 0) {
  const [data, setData] = useState(getCached("rafflesPolls") || null);
  const [loading, setLoading] = useState(!getCached("rafflesPolls"));
  useEffect(() => {
    setLoading(true);
    if (getCached("rafflesPolls")) { setData(getCached("rafflesPolls")); setLoading(false); return; }
    loadRafflesPolls().then(d => { setData(d); setLoading(false); });
  }, [refreshKey]);
  return { ...(data || { raffles: [], polls: [] }), loading };
}

export function useGiveawaysData(refreshKey = 0) {
  const [giveaways, setGiveaways] = useState(getCached("giveaways") || null);
  const [loading, setLoading] = useState(!getCached("giveaways"));
  useEffect(() => {
    setLoading(true);
    if (getCached("giveaways")) { setGiveaways(getCached("giveaways")); setLoading(false); return; }
    loadGiveaways().then(g => { setGiveaways(g); setLoading(false); });
  }, [refreshKey]);
  return { giveaways: giveaways || [], loading };
}

export function useOrganizersData() {
  const [data, setData] = useState(getCached("organizers") || null);
  const [loading, setLoading] = useState(!getCached("organizers"));
  useEffect(() => {
    if (getCached("organizers")) { setData(getCached("organizers")); setLoading(false); return; }
    loadOrganizers().then(d => { setData(d); setLoading(false); });
  }, []);
  return { ...(data || { organizerProfiles: [], listOrgRes: { data: { organizers: [] } } }), loading };
}

// ── Legacy default export (kept for backward compatibility) ───────────────────
// The Home page is rewritten to use the above hooks, but this stays to avoid
// import errors from any other file that may import useHomePageData.
export default function useHomePageData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      loadEvents(),
      loadArtistsAndMedia(),
      loadMediaGallery(),
      loadRafflesPolls(),
      loadOrganizers(),
    ]).then(([events, am, mg, rp, org]) => {
      setData({ events, ...am, ...mg, ...rp, ...org });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  return { data, loading };
}