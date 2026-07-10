import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { User, Camera, Trash2, Edit2, Building, MapPin, Phone, Globe, Instagram, Twitter, Copy, Check, ExternalLink, LogOut } from "lucide-react";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import BankDetailsFields, { validateBankDetails } from "@/components/shared/BankDetailsFields";
import NotificationPreferences from "@/components/organizer/NotificationPreferences";
import { APP_BASE_URL } from "@/lib/appUrl";
import LocationSelector from "@/components/shared/LocationSelector";
import OrganizerBioText from "@/components/organizer/OrganizerBioText";
import { BIO_MAX_CHARS, validateBio } from "@/utils/bioUtils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}([/?#].*)?$/i;
const PHONE_REGEX = /^[+]?[\d\s\-().]{7,20}$/;

const EMPTY_BANK_FORM = {
  account_holder_name: "", bank_name: "", account_number: "",
  routing_number: "", account_type: "checking", country: "USA", swift_code: "", iban: "", bank_address: "",
};

function BankInfoSection({ organizerId, organizerEmail }) {
  const [bankInfo, setBankInfo] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_BANK_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    base44.entities.OrganizerBankInfo.filter({ organizer_id: organizerId }, null, 1)
      .then(res => { if (res[0]) { setBankInfo(res[0]); setForm(res[0]); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [organizerId]);

  const updateField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const errs = validateBankDetails(form);
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (bankInfo) {
        await base44.entities.OrganizerBankInfo.update(bankInfo.id, form);
        setBankInfo({ ...bankInfo, ...form });
      } else {
        const created = await base44.entities.OrganizerBankInfo.create({ ...form, organizer_id: organizerId, organizer_email: organizerEmail });
        setBankInfo(created);
      }
      setEditing(false);
      setFieldErrors({});
      toast.success("Bank information saved successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to save bank information. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete your bank information?")) return;
    setDeleting(true);
    try {
      await base44.entities.OrganizerBankInfo.delete(bankInfo.id);
      setBankInfo(null);
      setForm(EMPTY_BANK_FORM);
      setFieldErrors({});
      setEditing(false);
      toast.success("Bank information deleted successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to delete bank information. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFieldErrors({});
    if (bankInfo) setForm(bankInfo);
  };

  if (loading) return <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />;

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold">Bank Information</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Used for payout processing. Visible only to you.</p>
        </div>
        {bankInfo && !editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5" disabled={deleting}><Edit2 className="w-3.5 h-3.5" /> Edit</Button>
            <Button size="sm" variant="outline" onClick={handleDelete} disabled={deleting} className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /> {deleting ? "Deleting..." : "Delete"}</Button>
          </div>
        )}
      </div>

      {!editing && bankInfo ? (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/20 text-sm text-green-400 font-mono font-bold">✓ Bank info on file</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Account Holder</span><p className="font-medium">{bankInfo.account_holder_name}</p></div>
            <div><span className="text-muted-foreground text-xs">Bank Name</span><p className="font-medium">{bankInfo.bank_name}</p></div>
            <div><span className="text-muted-foreground text-xs">Account Type</span><p className="font-medium capitalize">{bankInfo.account_type}</p></div>
            <div><span className="text-muted-foreground text-xs">Account Number</span><p className="font-mono">••••{bankInfo.account_number?.slice(-4)}</p></div>
            {bankInfo.routing_number && <div><span className="text-muted-foreground text-xs">Routing Number</span><p className="font-mono">••••{bankInfo.routing_number?.slice(-4)}</p></div>}
            {bankInfo.swift_code && <div><span className="text-muted-foreground text-xs">SWIFT/BIC</span><p className="font-mono">{bankInfo.swift_code}</p></div>}
          </div>
        </div>
      ) : !editing ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-muted-foreground">No bank info saved yet. Add your banking details to enable payout requests.</p>
          <Button onClick={() => setEditing(true)} className="gap-2"><Edit2 className="w-4 h-4" /> Add Bank Info</Button>
        </div>
      ) : (
        <div className="space-y-3">
           <BankDetailsFields form={form} onChange={updateField} errors={fieldErrors} bgClass="bg-background" showPassword />
           <div className="flex gap-2">
             <Button onClick={handleSave} disabled={saving || deleting} className="gap-2">{saving ? "Saving..." : "Save Bank Info"}</Button>
             <Button variant="outline" onClick={handleCancel} disabled={saving || deleting}>Cancel</Button>
           </div>
         </div>
      )}
    </div>
  );
}

export default function OrganizerProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageDirty, setImageDirty] = useState(false);
  const [removingImg, setRemovingImg] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    business_name: "", full_name: "", phone: "", bio: "",
    city: "", state: "", country: "", website: "", instagram: "", twitter: "",
    profile_image: "",
  });
  const fieldRefs = useRef({});
  const locationRef = useRef(null);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  const validate = () => {
    const errs = {};
    if (!form.business_name?.trim()) errs.business_name = "Organizer name is required.";
    if (form.phone?.trim() && !PHONE_REGEX.test(form.phone.trim())) errs.phone = "Please enter a valid phone number.";
    if (form.website?.trim() && !URL_REGEX.test(form.website.trim())) errs.website = "Please enter a valid website URL.";
    if (form.instagram?.trim() && !URL_REGEX.test(form.instagram.trim())) errs.instagram = "Please enter a valid Instagram URL.";
    if (form.twitter?.trim() && !URL_REGEX.test(form.twitter.trim())) errs.twitter = "Please enter a valid Twitter / X URL.";
    if (!form.country?.trim()) errs.country = "Please select a country.";
    if (!form.state?.trim()) errs.state = "Please select a state/region.";
    if (!form.city?.trim()) errs.city = "Please select a city.";
    const bioErr = validateBio(form.bio);
    if (bioErr) errs.bio = bioErr;
    return errs;
  };

  const focusFirstError = (errs) => {
    const order = ["business_name", "phone", "website", "instagram", "twitter", "country", "state", "city", "bio"];
    const firstKey = order.find((k) => errs[k]);
    if (!firstKey) return;
    const target = ["country", "state", "city"].includes(firstKey) ? locationRef.current : fieldRefs.current[firstKey];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      const profiles = await base44.entities.OrganizerProfile.filter({ organizer_id: u.id }, null, 1).catch(() => []);
      if (profiles[0]) {
        setProfile(profiles[0]);
        setForm(f => ({ ...f, ...profiles[0] }));
      } else {
        setForm(f => ({ ...f, full_name: u.full_name || "", profile_image: u.profile_image || "" }));
      }
      setLoading(false);
    })();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file
    setImageError("");
    if (!file) {
      setImageError("No file selected. Please choose an image.");
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Unsupported file type. Please upload a JPG, JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image is too large. Maximum file size is 5MB.");
      return;
    }
    setUploadingImg(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (!res?.file_url) throw new Error("Upload did not return a file URL.");
      setForm(f => ({ ...f, profile_image: res.file_url }));
      setImageDirty(true);
    } catch (err) {
      console.error("Profile image upload failed:", err);
      setImageError("Failed to upload image. Please try again.");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSave = async () => {
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, organizer_id: user.id, organizer_email: user.email, needs_name_review: false };
      if (profile) {
        await base44.entities.OrganizerProfile.update(profile.id, data);
        setProfile({ ...profile, ...data });
      } else {
        const created = await base44.entities.OrganizerProfile.create(data);
        setProfile(created);
      }
      // Sync the updated Organizer Name across all this organizer's events immediately
      const publicName = (form.business_name || "").trim();
      if (publicName) {
        base44.entities.Event.updateMany({ organizer_id: user.id }, { $set: { organizer_name: publicName } }).catch(() => {});
      }
      setEditing(false);
      setImageDirty(false);
      setImageError("");
      setFieldErrors({});
      toast.success("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to save organizer profile:", err);
      toast.error(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = async () => {
    setShowRemoveConfirm(false);
    setRemovingImg(true);
    setImageError("");
    try {
      if (profile) {
        await base44.entities.OrganizerProfile.update(profile.id, { profile_image: "" });
        setProfile((p) => ({ ...p, profile_image: "" }));
      }
      setForm((f) => ({ ...f, profile_image: "" }));
      setImageDirty(false);
      toast.success("Profile picture removed successfully.");
    } catch (err) {
      console.error("Failed to remove profile picture:", err);
      setImageError("Failed to remove profile picture. Please try again.");
      toast.error("Failed to remove profile picture. Please try again.");
    } finally {
      setRemovingImg(false);
    }
  };

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: null }));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const displayData = profile || {};

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">MY PROFILE</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{user?.email}</p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="gap-2"><Edit2 className="w-4 h-4" /> Edit Profile</Button>
        )}
      </div>

      {/* Profile Card */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {form.profile_image ? (
              <img src={form.profile_image} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-primary/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
            )}
            {editing && (
              <label className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 ${uploadingImg ? "opacity-70 pointer-events-none" : ""}`}>
                {uploadingImg ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImg} className="hidden" />
              </label>
            )}
          </div>
          <div>
            <p className="font-display font-bold text-xl">{displayData.business_name || displayData.full_name || user?.full_name || "—"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {displayData.city && <p className="text-xs text-muted-foreground font-mono mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{displayData.city}{displayData.state ? `, ${displayData.state}` : ""}{displayData.country ? `, ${displayData.country}` : ""}</p>}
            {editing && imageDirty && !imageError && <p className="text-xs text-primary mt-1">New photo selected — unsaved changes</p>}
            {editing && imageError && <p className="text-xs text-destructive mt-1">{imageError}</p>}
            {editing && form.profile_image && (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={removingImg}
                className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 mt-1.5 font-mono disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> {removingImg ? "Removing..." : "Remove Profile Picture"}
              </button>
            )}
          </div>
        </div>

        <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove your profile picture?</AlertDialogTitle>
              <AlertDialogDescription>This will remove your current profile picture and show the default avatar.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove Photo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "full_name", label: "Personal Name" },
                { key: "business_name", label: "Organizer Name *" },
                { key: "phone", label: "Phone" },
                { key: "website", label: "Website" },
                { key: "instagram", label: "Instagram URL" },
                { key: "twitter", label: "Twitter / X URL" },
              ].map(({ key, label }) => (
                <div key={key} ref={(el) => (fieldRefs.current[key] = el)}>
                  <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
                  <Input value={form[key] || ""} onChange={e => updateField(key, e.target.value)}
                    className={`mt-1 bg-background ${fieldErrors[key] ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`} />
                  {fieldErrors[key] && <p className="text-xs text-destructive mt-1">{fieldErrors[key]}</p>}
                </div>
              ))}
            </div>
            <div ref={locationRef}>
              <LocationSelector
                value={{ country: form.country, state: form.state, city: form.city }}
                onChange={({ country, state, city }) => { setForm(f => ({ ...f, country, state, city })); setFieldErrors(e => ({ ...e, country: null, state: null, city: null })); }}
                errors={fieldErrors}
                required={true}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                <span className={`text-[10px] font-mono ${(form.bio?.length || 0) > BIO_MAX_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.bio?.length || 0}/{BIO_MAX_CHARS}
                </span>
              </div>
              <textarea
                value={form.bio || ""}
                onChange={e => { setForm(f => ({ ...f, bio: e.target.value })); if (fieldErrors.bio) setFieldErrors(er => ({ ...er, bio: null })); }}
                maxLength={BIO_MAX_CHARS}
                rows={3}
                placeholder="A short description in up to 3 sentences — shown on your public profile."
                className={`mt-1 w-full rounded-md bg-background border px-3 py-2 text-sm ${fieldErrors.bio ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`}
              />
              <p className="text-xs text-muted-foreground mt-1">Keep it short — up to 3 sentences, {BIO_MAX_CHARS} characters max.</p>
              {fieldErrors.bio && <p className="text-xs text-destructive mt-1">{fieldErrors.bio}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">{saving ? "Saving..." : "Save Profile"}</Button>
              <Button variant="outline" onClick={() => { setEditing(false); setImageDirty(false); setImageError(""); setFieldErrors({}); if (profile) setForm({ ...form, ...profile }); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <OrganizerBioText bio={displayData.bio} />
            <div className="grid grid-cols-2 gap-3">
              {displayData.phone && <div><span className="text-xs text-muted-foreground block"><Phone className="w-3 h-3 inline mr-1" />Phone</span><p>{displayData.phone}</p></div>}
              {displayData.website && <div><span className="text-xs text-muted-foreground block"><Globe className="w-3 h-3 inline mr-1" />Website</span><a href={displayData.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">{displayData.website}</a></div>}
              {displayData.instagram && <div><span className="text-xs text-muted-foreground block"><Instagram className="w-3 h-3 inline mr-1" />Instagram</span><a href={displayData.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline truncate block">{displayData.instagram}</a></div>}
              {displayData.twitter && <div><span className="text-xs text-muted-foreground block"><Twitter className="w-3 h-3 inline mr-1" />Twitter</span><a href={displayData.twitter} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">{displayData.twitter}</a></div>}
            </div>
            {!displayData.phone && !displayData.bio && !displayData.city && (
              <p className="text-xs text-muted-foreground py-2">No profile info yet — click Edit Profile to add your details.</p>
            )}
          </div>
        )}
      </div>

      {/* Organizer Profile Link — prominent shareable card */}
      {user && (
        <div className="p-5 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Organizer Profile Link</p>
            <p className="text-xs text-muted-foreground mt-1">Share this link so fans can view your public profile, upcoming events, and loyalty program.</p>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border/50">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 font-mono text-sm text-foreground truncate">
              {APP_BASE_URL}/organizers/{user.id}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${APP_BASE_URL}/organizers/${user.id}`);
                setCopiedLink(true);
                toast.success("Profile link copied!");
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-mono font-bold transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? "Copied!" : "Copy Link"}
            </button>
            <a
              href={`/organizers/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-sm font-mono font-bold transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Preview Public Profile
            </a>
          </div>
        </div>
      )}

      {/* Notification Preferences */}
      {profile && (
        <NotificationPreferences
          profile={profile}
          onUpdate={(updates) => setProfile(p => ({ ...p, ...updates }))}
        />
      )}

      {/* Bank Info */}
      {user && <BankInfoSection organizerId={user.id} organizerEmail={user.email} />}

      {/* Account Actions */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Actions</p>
        <button
          onClick={() => base44.auth.logout("/")}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-display font-bold text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Danger Zone — non-admins only */}
      {user?.role !== "admin" && (
        <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-destructive">⚠ Danger Zone</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Permanently deleting your account will remove all your data and cannot be undone.
          </p>
          <DeleteAccountButton user={user} />
        </div>
      )}
    </div>
  );
}