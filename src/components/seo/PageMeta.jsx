import { useEffect } from "react";

/**
 * Sets document title, meta description, and canonical URL for a page.
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Meta description
 * @param {string} [props.canonical] - Canonical URL (defaults to window.location.href)
 * @param {string} [props.ogImage] - Open Graph image URL
 * @param {string} [props.ogType] - Open Graph type (default: "website")
 */
export default function PageMeta({ title, description, canonical, ogImage, ogType = "website" }) {
  useEffect(() => {
    if (!title && !description) return;

    const appUrl = "https://reizor.com";

    // Title
    if (title) {
      document.title = title.includes("REIZOR") ? title : `${title} — REIZOR`;
    }

    // Meta description
    if (description) {
      setOrCreateMeta("name", "description", description);
    }

    // Canonical
    const canonUrl = canonical || window.location.href.split("?")[0].split("#")[0];
    let canonEl = document.querySelector('link[rel="canonical"]');
    if (!canonEl) {
      canonEl = document.createElement("link");
      canonEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonEl);
    }
    canonEl.setAttribute("href", canonUrl);

    // Open Graph
    setOrCreateMeta("property", "og:title", title || document.title);
    if (description) setOrCreateMeta("property", "og:description", description);
    setOrCreateMeta("property", "og:url", canonUrl);
    setOrCreateMeta("property", "og:type", ogType);
    if (ogImage) setOrCreateMeta("property", "og:image", ogImage);

    // Twitter
    setOrCreateMeta("name", "twitter:title", title || document.title);
    if (description) setOrCreateMeta("name", "twitter:description", description);
    if (ogImage) setOrCreateMeta("name", "twitter:image", ogImage);
  }, [title, description, canonical, ogImage, ogType]);

  return null;
}

function setOrCreateMeta(attr, name, value) {
  if (!value) return;
  const selector = attr === "property"
    ? `meta[property="${name}"]`
    : `meta[name="${name}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}