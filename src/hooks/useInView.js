import { useState, useEffect, useRef } from "react";

/**
 * Hook that returns a ref and a boolean indicating whether the element
 * is in the viewport. Fires once and disconnects (triggers load only once).
 */
export default function useInView({ threshold = 0.05, rootMargin = "300px 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return [ref, inView];
}