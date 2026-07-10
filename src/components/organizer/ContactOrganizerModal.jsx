import { useState, useRef, useEffect } from "react";
import { X, Send, Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ModalPortal from "@/components/shared/ModalPortal";

export default function ContactOrganizerModal({ open, onClose, organizerEmail, organizerName }) {
    const [fanEmail, setFanEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState("");
    const [submitting, setSubmitting] = useState(false); // prevent double-submit
    const subjectRef = useRef(null);
    const messageRef = useRef(null);

    // Pre-fill fan email from current user on open
    useEffect(() => {
        if (!open) return;
        base44.auth.me().then(u => {
            if (u?.email) setFanEmail(u.email);
        }).catch(() => {});
    }, [open]);

    // Reset form when opening
    useEffect(() => {
        if (!open) return;
        setSubject("");
        setMessage("");
        setErrors({});
        setSent(false);
        setSendError("");
        setSubmitting(false);
    }, [open]);

    const validate = () => {
        const e = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!fanEmail.trim()) e.fanEmail = "Email is required";
        else if (!emailRegex.test(fanEmail.trim())) e.fanEmail = "Enter a valid email";
        if (!subject.trim()) e.subject = "Subject is required";
        if (!message.trim()) e.message = "Message is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        if (!validate()) return;

        setSubmitting(true);
        setLoading(true);
        setSendError("");

        try {
            const res = await base44.functions.invoke("contactOrganizer", {
                organizerEmail,
                organizerName,
                fanEmail: fanEmail.trim(),
                subject: subject.trim(),
                message: message.trim(),
            });
            if (res.data?.error) {
                setSendError(res.data.error);
            } else {
                setSent(true);
            }
        } catch {
            setSendError("Failed to send message. Please try again later.");
        } finally {
            setLoading(false);
            setSubmitting(false);
        }
    };

    return (
        <ModalPortal open={open} onBackdropClick={onClose}>
            {/* Modal — centered in viewport (accounts for bottom nav) */}
            <div
                className="relative w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: 'calc(100dvh - var(--bottom-nav-height) - 32px)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-card/95 backdrop-blur border-b border-border/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        <h2 className="font-display font-bold text-lg">Contact Organizer</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
                    {/* Missing organizer email */}
                    {!organizerEmail ? (
                        <div className="flex flex-col items-center text-center py-8 gap-3">
                            <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
                            <p className="font-display font-bold text-base">Organizer contact email is not available right now.</p>
                            <p className="text-sm text-muted-foreground">Please try again later or reach out through other channels.</p>
                        </div>
                    ) : sent ? (
                        /* Success */
                        <div className="flex flex-col items-center text-center py-6 gap-3">
                            <CheckCircle2 className="w-12 h-12 text-green-400" />
                            <p className="font-display font-bold text-lg">Your message has been sent.</p>
                            <p className="text-sm text-muted-foreground">Please allow 24–48 hours for a response.</p>
                            <button
                                onClick={onClose}
                                className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        /* Form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Fan Email */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                                    Your Email <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={fanEmail}
                                    onChange={e => { setFanEmail(e.target.value); setErrors(prev => ({ ...prev, fanEmail: "" })); }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); subjectRef.current?.focus(); }}}
                                    placeholder="you@example.com"
                                    className="w-full h-10 px-3 rounded-lg bg-transparent border border-white/25 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    autoFocus
                                    autoComplete="email"
                                />
                                {errors.fanEmail && <p className="text-xs text-destructive mt-1">{errors.fanEmail}</p>}
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                                    Subject <span className="text-destructive">*</span>
                                </label>
                                <input
                                    ref={subjectRef}
                                    type="text"
                                    value={subject}
                                    onChange={e => { setSubject(e.target.value); setErrors(prev => ({ ...prev, subject: "" })); }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); messageRef.current?.focus(); }}}
                                    placeholder="Booking inquiry, question, etc."
                                    maxLength={200}
                                    className="w-full h-10 px-3 rounded-lg bg-transparent border border-white/25 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                                {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                                    Message <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    ref={messageRef}
                                    value={message}
                                    onChange={e => { setMessage(e.target.value); setErrors(prev => ({ ...prev, message: "" })); }}
                                    placeholder="Write your message here..."
                                    rows={4}
                                    maxLength={5000}
                                    className="w-full px-3 py-2.5 rounded-lg bg-transparent border border-white/25 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                />
                                {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
                            </div>

                            {/* Error banner */}
                            {sendError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                                    <p className="text-sm text-destructive">{sendError}</p>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Message
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </ModalPortal>
    );
}