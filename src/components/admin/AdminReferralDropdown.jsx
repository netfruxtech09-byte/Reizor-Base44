import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Copy, X, Check } from "lucide-react";

export default function AdminReferralDropdown({ user }) {
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  const refCode = `admin_${user?.id?.slice(-8)}`;
  const refLink = `${window.location.origin}/?ref=${refCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(refLink)}`;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={ref} className="relative">
      <Link
        to="/admin"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
      >
        <LayoutDashboard className="w-4 h-4" />
        Admin
      </Link>

      {/* QR Modal */}
      {qrOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setQrOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display font-bold">Admin Referral QR</p>
              <button onClick={() => setQrOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center p-3 bg-white rounded-xl">
              <img src={qrUrl} alt="Referral QR Code" className="w-48 h-48" />
            </div>
            <p className="text-xs text-muted-foreground text-center font-mono break-all">{refLink}</p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}