// Shared limits + helpers for the organizer public description ("bio").
export const BIO_MAX_CHARS = 400;
export const BIO_MAX_SENTENCES = 3;

export function countSentences(text) {
  if (!text) return 0;
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (matches) return matches.length;
  return text.trim() ? 1 : 0;
}

// Truncates text to the first N sentences (default 3), then hard-caps by
// character count as a fallback for run-on sentences without punctuation.
export function truncateBioForDisplay(text, maxSentences = BIO_MAX_SENTENCES, maxChars = BIO_MAX_CHARS) {
  if (!text) return "";
  const trimmed = text.trim();
  const sentenceMatches = trimmed.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  let result = sentenceMatches.slice(0, maxSentences).join("").trim();
  if (!result) result = trimmed;
  if (result.length > maxChars) result = `${result.slice(0, maxChars).trim()}...`;
  return result;
}

// Returns an error message string if the bio exceeds the allowed limits, else null.
export function validateBio(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length > BIO_MAX_CHARS) return `Description must be ${BIO_MAX_CHARS} characters or less.`;
  if (countSentences(trimmed) > BIO_MAX_SENTENCES) return `Organizer description must be no more than ${BIO_MAX_SENTENCES} short sentences.`;
  return null;
}