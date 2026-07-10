import { useState } from "react";
import { Music } from "lucide-react";

/**
 * ArtistAvatar — reusable artist profile image with multi-field fallback.
 *
 * Resolves the image from any of the known fields (profile_image, avatar, image,
 * profile_picture_url) so legacy records display correctly. Falls back to
 * cover_image/banner_image when no profile image exists. Shows the music-note
 * placeholder ONLY when no image is found or the image fails to load (onError).
 * Uses object-fit: cover so pictures fill the space without distortion.
 */
export default function ArtistAvatar({ artist, className = "", iconClass = "w-5 h-5", rounded = "rounded-full" }) {
  const [imgError, setImgError] = useState(false);

  const imageSrc = !imgError && (
    artist?.profile_image ||
    artist?.avatar ||
    artist?.image ||
    artist?.profile_picture_url ||
    artist?.cover_image ||
    artist?.banner_image
  );

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={artist?.display_name || "Artist"}
        className={`${rounded} object-cover ${className}`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`${rounded} bg-primary/10 border-2 border-primary/30 flex items-center justify-center ${className}`}>
      <Music className={`text-primary ${iconClass}`} />
    </div>
  );
}