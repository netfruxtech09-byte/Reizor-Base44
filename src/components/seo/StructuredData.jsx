import { useEffect, useRef } from "react";

/**
 * Injects JSON-LD structured data into the page head.
 * @param {Object} props
 * @param {Object} props.data - The JSON-LD object (without script tag)
 */
export default function StructuredData({ data }) {
  const scriptId = useRef(`jsonld-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!data) return;

    // Remove previous instance
    const prev = document.getElementById(scriptId.current);
    if (prev) prev.remove();

    const script = document.createElement("script");
    script.id = scriptId.current;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById(scriptId.current);
      if (el) el.remove();
    };
  }, [data]);

  return null;
}