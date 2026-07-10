import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { uploadToSpaces } from "@/utils/spacesStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Music, Instagram, Twitter, Upload, CheckCircle2, ArrowLeft, ImageOff } from "lucide-react";
import LocationSelector from "@/components/shared/LocationSelector";

const GENRES = [
  "techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb",
  "pop", "rock", "jazz", "electronic", "latin", "reggaeton", "afrobeats", "other",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidUrl(url) {
  const v = url.trim();
  if (!v) return true; // empty is OK (optional individually)
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ArtistSignup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [existingArtist, setExistingArtist] = useState(null);

  // Edit mode: ?mode=edit — reuse this same form to edit an already-approved
  // artist profile. Edits are submitted for admin approval (not applied live).
  const [editMode, setEditMode] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null);

  const [selectedGenres, setSelectedGenres] = useState(["electronic"]);
  const [customGenreInput, setCustomGenreInput] = useState("");

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const firstErrorRef = useRef(null);

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    genre: "electronic",
    location: "",
    city: "",
    state: "",
    country: "",
    contact_email: "",
    website: "",
    instagram: "",
    twitter: "",
    soundcloud: "",
    spotify: "",
    tiktok: "",
  });

  const toggleGenre = (g) => {
    const next = selectedGenres.includes(g)
      ? selectedGenres.filter(x => x !== g)
      : [...selectedGenres, g];
    setSelectedGenres(next);
    setForm(f => ({ ...f, genre: next.join(",") }));
    setErrors(prev => ({
      ...prev,
      genres: next.length > 0 ? "" : (touched.genres ? "Please select at least one genre." : prev.genres),
    }));
  };

  useEffect(() => {
    localStorage.removeItem("artist_signup_intent");

    const isEditMode = new URLSearchParams(window.location.search).get("mode") === "edit";
    setEditMode(isEditMode);

    base44.auth.me().then(async (u) => {
      if (!u) {
        base44.auth.redirectToLogin("/artist/signup");
        return;
      }
      setUser(u);
      setForm((f) => ({
        ...f,
        display_name: u.full_name || "",
        contact_email: u.email || "",
      }));
      const existing = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      if (existing.length > 0) {
        const artist = existing[0];

        if (isEditMode) {
          // ── Edit mode ──
          // Pre-fill every field from the approved live record, regardless of
          // approval status. (Non-approved artists shouldn't reach here, but we
          // still load safely.)
          setExistingArtist(artist);
          setProfileImage(artist.profile_image || "");
          const genres = artist.genre ? artist.genre.split(",").map(g => g.trim()).filter(Boolean) : ["electronic"];
          setSelectedGenres(genres);
          setForm({
            display_name: artist.display_name || u.full_name || "",
            bio: artist.bio || "",
            genre: artist.genre || "electronic",
            location: artist.location || "",
            city: artist.city || "",
            state: artist.state || "",
            country: artist.country || "",
            contact_email: artist.contact_email || u.email || "",
            website: artist.website || "",
            instagram: artist.instagram || "",
            twitter: artist.twitter || "",
            soundcloud: artist.soundcloud || "",
            spotify: artist.spotify || "",
            tiktok: artist.tiktok || "",
          });

          // If a pending edit already exists, load its values so the artist
          // resumes editing the existing request (no duplicates).
          const pending = await base44.entities.ArtistProfileEdit
            .filter({ artist_id: artist.id, status: "pending_review" }, "-created_date", 1)
            .catch(() => []);
          if (pending[0]) {
            setPendingEdit(pending[0]);
            const pd = pending[0].pending_data || {};
            if (pd.profile_image) setProfileImage(pd.profile_image);
            const g = pd.genre ? pd.genre.split(",").map(x => x.trim()).filter(Boolean) : genres;
            setSelectedGenres(g);
            setForm(f => ({
              ...f,
              display_name: pd.display_name ?? f.display_name,
              bio: pd.bio ?? f.bio,
              genre: pd.genre ?? f.genre,
              location: pd.location ?? f.location,
              city: pd.city ?? f.city,
              state: pd.state ?? f.state,
              country: pd.country ?? f.country,
              contact_email: pd.contact_email ?? f.contact_email,
              website: pd.website ?? f.website,
              instagram: pd.instagram ?? f.instagram,
              twitter: pd.twitter ?? f.twitter,
              soundcloud: pd.soundcloud ?? f.soundcloud,
              spotify: pd.spotify ?? f.spotify,
              tiktok: pd.tiktok ?? f.tiktok,
            }));
          }
          setLoading(false);
          return;
        }

        // ── Signup mode (existing behavior) ──
        if (artist.approval_status === "approved") {
          navigate("/artist", { replace: true });
          return;
        }
        if (artist.approval_status === "pending") {
          setSubmitted(true);
          setLoading(false);
          return;
        }
        if (artist.approval_status === "rejected") {
          setExistingArtist(artist);
          setProfileImage(artist.profile_image || "");
          const genres = artist.genre ? artist.genre.split(",").map(g => g.trim()) : ["electronic"];
          setSelectedGenres(genres);
          setForm({
            display_name: artist.display_name || u.full_name || "",
            bio: artist.bio || "",
            genre: artist.genre || "electronic",
            location: artist.location || "",
            city: artist.city || "",
            state: artist.state || "",
            country: artist.country || "",
            contact_email: artist.contact_email || u.email || "",
            website: artist.website || "",
            instagram: artist.instagram || "",
            twitter: artist.twitter || "",
            soundcloud: artist.soundcloud || "",
            spotify: artist.spotify || "",
            tiktok: artist.tiktok || "",
          });
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const SOCIAL_FIELDS = ["instagram", "twitter", "soundcloud", "spotify", "tiktok", "website"];

  const validateField = (field, value) => {
    let err = "";
    switch (field) {
      case "display_name":
        if (!value?.trim()) err = "Artist name is required.";
        break;
      case "contact_email":
        if (!value?.trim() || !isValidEmail(value)) err = "Please enter a valid email address.";
        break;
      case "bio":
        if (!value?.trim()) err = "Please add a short artist bio.";
        break;
      case "country":
        if (!value) err = "Please select a country.";
        break;
      case "state":
        if (!value) err = "Please select a state/region.";
        break;
      case "city":
        if (!value) err = "Please select a city.";
        break;
      case "website":
        if (value?.trim() && !isValidUrl(value)) err = "Please enter a valid website or social link.";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [field]: err }));
    return err;
  };

  const updateField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    // Clear social-group error if any social field now has a value
    if (SOCIAL_FIELDS.includes(field)) {
      const allSocial = { ...form, [field]: value };
      const hasAny = SOCIAL_FIELDS.some(f => allSocial[f]?.trim());
      if (hasAny) setErrors(prev => ({ ...prev, social: "" }));
    }
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, form[field]);
  };

  const validateAll = () => {
    const errs = {};
    if (!form.display_name.trim()) errs.display_name = "Artist name is required.";
    if (!profileImage || typeof profileImage !== "string") errs.profile_image = "Please upload a profile image.";
    if (!form.contact_email.trim() || !isValidEmail(form.contact_email)) errs.contact_email = "Please enter a valid email address.";
    if (!form.bio.trim()) errs.bio = "Please add a short artist bio.";
    if (!form.country) errs.country = "Please select a country.";
    if (!form.state) errs.state = "Please select a state/region.";
    if (!form.city) errs.city = "Please select a city.";
    if (selectedGenres.length === 0) errs.genres = "Please select at least one genre.";
    const hasSocial = SOCIAL_FIELDS.some(f => form[f]?.trim());
    if (!hasSocial) errs.social = "Please enter a valid website or social link.";
    if (form.website?.trim() && !isValidUrl(form.website)) errs.website = "Please enter a valid website or social link.";
    setErrors(errs);
    return errs;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Type validation
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, profile_image: "Unsupported image type. Please upload JPG, PNG, or WebP." }));
      toast.error("Unsupported image type. Please upload JPG, PNG, or WebP.");
      e.target.value = "";
      return;
    }
    // Size validation
    if (file.size > MAX_IMAGE_SIZE) {
      setErrors(prev => ({ ...prev, profile_image: "Image file is too large." }));
      toast.error("Image file is too large (max 5 MB).");
      e.target.value = "";
      return;
    }

    setUploadingImage(true);
    setImagePreviewError(false);
    setErrors(prev => ({ ...prev, profile_image: "" }));
    try {
      const folder = existingArtist?.id
        ? `artists/${existingArtist.id}/media`
        : "artists/signups";
      const result = await uploadToSpaces(file, folder);
      // uploadToSpaces returns { file_url, file_size_bytes } — extract the URL string
      const url = result?.file_url;
      if (!url || typeof url !== "string") {
        throw new Error("Upload succeeded but no valid image URL was returned.");
      }
      setProfileImage(url);
      setImagePreviewError(false);
    } catch (err) {
      toast.error(err.message || "Image upload failed. Please try again.");
      setErrors(prev => ({ ...prev, profile_image: "Image upload failed. Please try again." }));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const scrollToFirstError = (errs) => {
    setTimeout(() => {
      const firstField = Object.keys(errs)[0];
      if (!firstField) return;
      const el = document.querySelector(`[data-error-field="${firstField}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadingImage) {
      toast.error("Please wait for the image upload to finish.");
      return;
    }
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setTouched({
        display_name: true, profile_image: true, contact_email: true, bio: true,
        country: true, state: true, city: true, genres: true, social: true, website: true,
      });
      scrollToFirstError(errs);
      return;
    }

    setSubmitting(true);
    const locationStr = [form.city, form.state, form.country].filter(Boolean).join(", ");
    const artistData = { ...form, location: locationStr || form.location };
    try {
      if (editMode && existingArtist) {
        // Edit mode: submit changes for admin approval. The live public profile
        // stays unchanged until an admin explicitly approves.
        const res = await base44.functions.invoke("submitArtistProfileEdit", {
          artist_id: existingArtist.id,
          pending_data: { ...artistData, profile_image: profileImage },
        });
        if (!res?.data?.success) {
          throw new Error(res?.data?.error || "Failed to submit profile changes.");
        }
        setSubmitted(true);
      } else if (existingArtist) {
        await base44.entities.Artist.update(existingArtist.id, {
          ...artistData,
          profile_image: profileImage,
          approval_status: "pending",
          status: "active",
          rejection_reason: "",
        });
        setSubmitted(true);
      } else {
        await base44.entities.Artist.create({
          ...artistData,
          user_id: user.id,
          user_email: user.email,
          profile_image: profileImage,
          approval_status: "pending",
          status: "active",
        });
        setSubmitted(true);
      }
    } catch (err) {
      const msg = err?.message || "Failed to submit application. Please try again.";
      toast.error(msg);
      // Surface backend validation errors inline where possible
      if (/email/i.test(msg)) {
        setErrors(prev => ({ ...prev, contact_email: msg }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel an existing pending edit request and reset the form to the live
  // approved values so the artist can start fresh.
  const cancelPendingRequest = async () => {
    if (!pendingEdit || !existingArtist) return;
    try {
      await base44.entities.ArtistProfileEdit.delete(pendingEdit.id);
      setPendingEdit(null);
      setProfileImage(existingArtist.profile_image || "");
      const genres = existingArtist.genre ? existingArtist.genre.split(",").map(g => g.trim()).filter(Boolean) : ["electronic"];
      setSelectedGenres(genres);
      setForm({
        display_name: existingArtist.display_name || "",
        bio: existingArtist.bio || "",
        genre: existingArtist.genre || "electronic",
        location: existingArtist.location || "",
        city: existingArtist.city || "",
        state: existingArtist.state || "",
        country: existingArtist.country || "",
        contact_email: existingArtist.contact_email || "",
        website: existingArtist.website || "",
        instagram: existingArtist.instagram || "",
        twitter: existingArtist.twitter || "",
        soundcloud: existingArtist.soundcloud || "",
        spotify: existingArtist.spotify || "",
        tiktok: existingArtist.tiktok || "",
      });
      toast.success("Pending request cancelled. You can edit and submit again.");
    } catch (err) {
      toast.error(err?.message || "Could not cancel the pending request.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">
              {editMode ? "Changes Submitted" : "Application Submitted!"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              {editMode
                ? "Your profile changes have been submitted for approval. Your current public profile will remain visible until the changes are approved."
                : "Your artist profile is under review. We'll notify you once it's approved, usually within 24–48 hours."}
            </p>
          </div>
          <Button onClick={() => navigate(editMode && existingArtist ? `/artists/${existingArtist.id}` : "/", { replace: true })} variant="outline" className="w-full font-display font-bold">
            {editMode ? "Back to Profile" : "Back to Home"}
          </Button>
        </div>
      </div>
    );
  }

  const inputErrClass = (field) =>
    errors[field] ? "border-destructive ring-1 ring-destructive/40" : "border-border/50";

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12 px-4 mobile-bottom-nav-spacing safe-top-header">
      <div className="w-full max-w-3xl mx-auto space-y-6 sm:space-y-8">
        {/* Back Button — returns to the page the user came from */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/", { replace: true });
            }
          }}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight break-words">
            {editMode ? "Edit Artist Profile" : existingArtist ? "Reapply as Artist" : "Artist Signup"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            {editMode
              ? "Update your profile and submit changes for admin approval"
              : existingArtist
                ? "Update your profile and resubmit for approval"
                : "Create your artist profile and get approved to start earning"}
          </p>
          {editMode && pendingEdit ? (
            <div className="mt-3 max-w-md mx-auto text-center space-y-2">
              <div className="px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <p className="text-yellow-400 text-[10px] sm:text-xs font-mono leading-tight">Profile changes are pending admin approval. Your current public profile is still live. Editing here updates your pending request.</p>
              </div>
              <button
                type="button"
                onClick={cancelPendingRequest}
                className="text-[10px] sm:text-xs font-mono text-muted-foreground hover:text-destructive underline underline-offset-2"
              >
                Cancel pending request and start over
              </button>
            </div>
          ) : existingArtist && !editMode ? (
            <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30 inline-block max-w-xs">
              <p className="text-yellow-400 text-[10px] sm:text-xs font-mono leading-tight">Your previous application was not approved. Update your info and resubmit.</p>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Profile Image */}
          <div data-error-field="profile_image">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-card border border-border/50 overflow-hidden flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                {uploadingImage ? (
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                ) : profileImage && !imagePreviewError ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={() => setImagePreviewError(true)}
                  />
                ) : profileImage && imagePreviewError ? (
                  <div className="text-center px-1 flex flex-col items-center justify-center">
                    <ImageOff className="w-5 h-5 text-muted-foreground" />
                    <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">Preview failed</p>
                  </div>
                ) : (
                  <Music className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <Label className="text-sm text-muted-foreground font-medium block">Profile Photo *</Label>
                <label className={`mt-1 flex items-center justify-center sm:justify-start gap-2 cursor-pointer px-3 py-2 rounded-md border bg-card text-xs sm:text-sm transition-colors w-full sm:w-fit ${uploadingImage ? "opacity-60 pointer-events-none" : "hover:border-primary/40"} ${errors.profile_image ? "border-destructive" : "border-border/50"}`}>
                  {uploadingImage ? (
                    <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="text-sm">{uploadingImage ? "Uploading image…" : profileImage ? "Change Photo" : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage || submitting}
                  />
                </label>
                {imagePreviewError && profileImage && !uploadingImage && (
                  <p className="text-xs text-yellow-400 mt-1.5">Image uploaded successfully, but preview could not load.</p>
                )}
                {errors.profile_image && (
                  <p className="text-xs text-destructive mt-1.5">{errors.profile_image}</p>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm sm:text-base">Basic Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Artist Name */}
              <div className="sm:col-span-2" data-error-field="display_name">
                <Label className="text-sm text-muted-foreground font-medium">Artist / Stage Name *</Label>
                <Input
                  value={form.display_name}
                  onChange={e => updateField("display_name", e.target.value)}
                  onBlur={() => handleBlur("display_name")}
                  placeholder="Your artist name"
                  className={`mt-1 bg-secondary text-sm ${inputErrClass("display_name")}`}
                />
                {errors.display_name && <p className="text-xs text-destructive mt-1">{errors.display_name}</p>}
              </div>

              {/* Genres */}
              <div className="sm:col-span-2" data-error-field="genres">
                <Label className="text-sm text-muted-foreground font-medium">Genre(s) — select all that apply *</Label>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                  {GENRES.map(g => (
                    <button key={g} type="button" onClick={() => toggleGenre(g)}
                      className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold border transition-all ${
                        selectedGenres.includes(g)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}>
                      {g.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                  {selectedGenres.filter(g => !GENRES.includes(g)).map(g => (
                    <span key={g} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border bg-accent text-accent-foreground border-accent">
                      {g.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      <button type="button" onClick={() => {
                        const next = selectedGenres.filter(x => x !== g);
                        setSelectedGenres(next);
                        setForm(f => ({ ...f, genre: next.join(",") }));
                        setErrors(prev => ({
                          ...prev,
                          genres: next.length > 0 ? "" : (touched.genres ? "Please select at least one genre." : prev.genres),
                        }));
                      }} className="ml-0.5 hover:opacity-70 leading-none text-sm">×</button>
                    </span>
                  ))}
                </div>

                {/* Custom genre input */}
                <div className="mt-3 flex gap-2 items-center">
                  <Input
                    value={customGenreInput}
                    onChange={e => setCustomGenreInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = customGenreInput.trim().toLowerCase().replace(/\s+/g, "_");
                        if (val && !selectedGenres.includes(val)) {
                          const next = [...selectedGenres, val];
                          setSelectedGenres(next);
                          setForm(f => ({ ...f, genre: next.join(",") }));
                          setErrors(prev => ({ ...prev, genres: "" }));
                        }
                        setCustomGenreInput("");
                      }
                    }}
                    placeholder="Add custom genre..."
                    className="bg-secondary border-border/50 text-sm h-8 max-w-xs"
                  />
                  <button type="button"
                    onClick={() => {
                      const val = customGenreInput.trim().toLowerCase().replace(/\s+/g, "_");
                      if (val && !selectedGenres.includes(val)) {
                        const next = [...selectedGenres, val];
                        setSelectedGenres(next);
                        setForm(f => ({ ...f, genre: next.join(",") }));
                        setErrors(prev => ({ ...prev, genres: "" }));
                      }
                      setCustomGenreInput("");
                    }}
                    className="px-3 py-1 rounded-md bg-accent text-accent-foreground text-xs font-mono font-bold hover:bg-accent/90 transition-colors shrink-0 h-8">
                    + Add
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Can't find your genre? Type it above and click "+ Add".</p>
                {errors.genres && <p className="text-xs text-destructive mt-1">{errors.genres}</p>}
              </div>

              {/* Location */}
              <div className="sm:col-span-2" data-error-field="country">
                <Label className="text-sm text-muted-foreground font-medium block mb-1">Location *</Label>
                <LocationSelector
                  value={{ country: form.country, state: form.state, city: form.city }}
                  onChange={({ country, state, city }) => {
                    setForm(f => ({ ...f, country, state, city }));
                    setErrors(prev => ({
                      ...prev,
                      country: country ? "" : prev.country,
                      state: state ? "" : prev.state,
                      city: city ? "" : prev.city,
                    }));
                  }}
                  errors={{ country: errors.country, state: errors.state, city: errors.city }}
                  required
                />
              </div>

              <div className="sm:col-span-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs sm:text-sm text-primary leading-relaxed">
                  Enter your city and state so fans can get notified when there is an event in their area. Organizers will also get notified when you are booked or when you are in the same country, making it easier to connect for potential opportunities.
                </p>
              </div>

              {/* Bio */}
              <div className="sm:col-span-2" data-error-field="bio">
                <Label className="text-sm text-muted-foreground font-medium">Bio *</Label>
                <textarea
                  value={form.bio}
                  onChange={e => updateField("bio", e.target.value)}
                  onBlur={() => handleBlur("bio")}
                  rows={4}
                  placeholder="Tell us about yourself and your music..."
                  className={`mt-1 w-full rounded-md bg-secondary px-3 py-2 text-sm ${inputErrClass("bio")}`}
                />
                {errors.bio && <p className="text-xs text-destructive mt-1">{errors.bio}</p>}
              </div>

              {/* Contact Email */}
              <div className="sm:col-span-2" data-error-field="contact_email">
                <Label className="text-sm text-muted-foreground font-medium">Booking / Contact Email *</Label>
                <Input
                  value={form.contact_email}
                  onChange={e => updateField("contact_email", e.target.value)}
                  onBlur={() => handleBlur("contact_email")}
                  placeholder="booking@yourdomain.com"
                  className={`mt-1 bg-secondary text-sm ${inputErrClass("contact_email")}`}
                />
                <p className="text-xs text-muted-foreground mt-0.5">Booking requests will be sent to this email</p>
                {errors.contact_email && <p className="text-xs text-destructive mt-1">{errors.contact_email}</p>}
              </div>

              {/* Website */}
              <div className="sm:col-span-2" data-error-field="website">
                <Label className="text-sm text-muted-foreground font-medium">Website</Label>
                <Input
                  value={form.website}
                  onChange={e => updateField("website", e.target.value)}
                  onBlur={() => handleBlur("website")}
                  placeholder="https://yoursite.com"
                  className={`mt-1 bg-secondary text-sm ${inputErrClass("website")}`}
                />
                {errors.website && <p className="text-xs text-destructive mt-1">{errors.website}</p>}
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-xl bg-card border border-border/50" data-error-field="social">
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base">Social &amp; Music Links</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">At least one required for verification *</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm text-muted-foreground font-medium flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                <Input value={form.instagram} onChange={e => updateField("instagram", e.target.value)}
                  placeholder="https://instagram.com/..." className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground font-medium flex items-center gap-1"><Twitter className="w-3.5 h-3.5" /> Twitter / X</Label>
                <Input value={form.twitter} onChange={e => updateField("twitter", e.target.value)}
                  placeholder="https://twitter.com/..." className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground font-medium">SoundCloud</Label>
                <Input value={form.soundcloud} onChange={e => updateField("soundcloud", e.target.value)}
                  placeholder="https://soundcloud.com/..." className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground font-medium">Spotify</Label>
                <Input value={form.spotify} onChange={e => updateField("spotify", e.target.value)}
                  placeholder="https://open.spotify.com/..." className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground font-medium">TikTok</Label>
                <Input value={form.tiktok} onChange={e => updateField("tiktok", e.target.value)}
                  placeholder="https://www.tiktok.com/@username" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
            </div>
            {errors.social && <p className="text-xs text-destructive mt-1">{errors.social}</p>}
          </div>

          <div className="flex gap-3">
            {editMode && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={submitting || uploadingImage}
                className="flex-1 sm:flex-none h-10 sm:h-12 font-display font-bold text-sm sm:text-base"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting || uploadingImage}
              className="flex-1 h-10 sm:h-12 glow-lime font-display font-bold text-sm sm:text-base"
            >
              {submitting
                ? (editMode ? "Submitting Changes…" : "Creating Artist Profile…")
                : uploadingImage
                  ? "Uploading image…"
                  : editMode ? "Submit Changes" : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}