/**
 * Detect if a URL is a video or image based on extension and MIME type patterns
 * @param {string} url - The media URL
 * @returns {boolean} - True if video, false if image
 */
export function isVideoUrl(url) {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  
  // Check common video extensions
  const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi', '.flv'];
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return true;
  }
  
  // Check for video MIME type patterns in URL (some services add this)
  if (urlLower.includes('video/')) {
    return true;
  }
  
  return false;
}

/**
 * Get CSS classes for media element to maintain aspect ratio and coverage
 * @returns {string} - Tailwind classes
 */
export function getMediaClasses() {
  return 'w-full h-full object-cover';
}