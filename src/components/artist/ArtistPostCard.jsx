import { useState } from "react";
import { format } from "date-fns";
import { MessageCircle, Share2, ChevronDown, ChevronUp, Music, Calendar, Gift, Ticket, FileAudio, Play, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoThumbnail from "@/components/media/VideoThumbnail";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import TicketLinkButton from "@/components/shared/TicketLinkButton";
import PostCaption from "@/components/artist/PostCaption";

const TYPE_CONFIG = {
  raffle:  { label: "🎁 Raffle",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  ticket:  { label: "🎟 Ticket",  cls: "text-green-400 bg-green-400/10 border-green-400/20" },
  event:   { label: "📅 Event",   cls: "text-accent bg-accent/10 border-accent/20" },
  media:   { label: "🎵 Media",   cls: "text-primary bg-primary/10 border-primary/20" },
  text:    { label: "✍️ Post",    cls: "text-muted-foreground bg-muted border-border/30" },
};

function MediaGrid({ post }) {
  const items = (post.media_urls || []).filter(Boolean);
  if (!items.length) return null;

  // Filter out unplayable videos (only if post has is_playable field set)
  const isPlayable = post.is_playable !== false;

  return (
    <div className="space-y-2">
      {items.map((url, i) => {
        const type = post.media_types?.[i];
        const is360 = type === "video360" || post.media_is360?.[i] === true;

        if (type === "image") {
          return (
            <div key={i} className="w-full rounded-xl overflow-hidden bg-muted">
              <img
                src={url}
                alt=""
                className="w-full object-cover max-h-96"
                loading="lazy"
              />
            </div>
          );
        }

        if (is360) {
          if (!isPlayable) {
            return (
              <div key={i} className="w-full p-6 rounded-xl bg-black/80 border border-border/40 flex flex-col items-center gap-2 text-center">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-mono">This video is currently unavailable due to streaming limits.</p>
              </div>
            );
          }
          return (
            <div key={i} className="rounded-xl overflow-hidden">
              <MediaVideoPlayer
                src={url}
                poster={post.media_thumbnails?.[i]}
                trackingVideoId={post.id}
                trackingVideoType="normal"
                trackingOwnerType="artist"
                className="w-full"
              />
            </div>
          );
        }

        if (type === "video") {
          if (!isPlayable) {
            return (
              <div key={i} className="w-full p-6 rounded-xl bg-black/80 border border-border/40 flex flex-col items-center gap-2 text-center">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-mono">This video is currently unavailable due to streaming limits.</p>
              </div>
            );
          }
          return (
            <div key={i} className="rounded-xl overflow-hidden">
              <MediaVideoPlayer
                src={url}
                poster={post.media_thumbnails?.[i]}
                trackingVideoId={post.id}
                trackingVideoType="normal"
                trackingOwnerType="artist"
                className="w-full"
              />
            </div>
          );
        }

        if (type === "audio") {
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border/40">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <FileAudio className="w-4 h-4 text-primary" />
              </div>
              <audio src={url} controls className="flex-1 h-8 min-w-0" style={{ colorScheme: "dark" }} />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function ArtistPostCard({
  post, artist, user, raffle,
  expandedPost, onToggleComments,
  comments, newComment, onNewCommentChange, onSubmitComment,
  onShare, onEnterRaffle,
  canEdit, onEdit,
}) {
  const isExpanded = expandedPost === post.id;
  const typeConfig = TYPE_CONFIG[post.type] || TYPE_CONFIG.text;
  const postDate = format(new Date(post.created_date), "MMM d, yyyy");

  return (
    <article className="rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm hover:border-border/70 transition-colors">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {artist.profile_image ? (
          <img src={artist.profile_image} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-border/40" alt="" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{artist.display_name}</p>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{postDate}</p>
        </div>
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${typeConfig.cls}`}>
          {typeConfig.label}
        </span>
        {canEdit && (
          <button
            onClick={() => onEdit?.(post)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-primary/15 border-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:shadow-primary/40 active:scale-95 transition-all"
            aria-label="Edit post"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Cover Image ── */}
      {post.cover_image && (
        <div className="w-full max-h-80 overflow-hidden bg-black">
          <img src={post.cover_image} alt="" className="w-full object-cover" />
        </div>
      )}

      {/* ── Caption ── */}
      <PostCaption text={post.caption} />

      {/* ── Tags ── */}
      {post.tags?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {post.tags.map((t, i) => (
            <span key={i} className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{t}</span>
          ))}
        </div>
      )}

      {/* ── Media ── */}
      {post.media_urls?.length > 0 && (
        <div className="px-4 pb-3">
          <MediaGrid post={post} />
        </div>
      )}

      {/* ── Event Info ── */}
      {post.event_title && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-accent/8 border border-accent/20 flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">{post.event_title}</p>
            {post.event_date && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {format(new Date(post.event_date), "MMM dd, yyyy")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Ticket Info ── */}
      {post.type === "ticket" && post.ticket_price !== undefined && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-green-400/8 border border-green-400/20 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-green-400 font-bold uppercase tracking-widest">
              {post.ticket_price === 0 ? "Free Ticket" : "Discounted Ticket"}
            </p>
            <p className="font-display font-black text-xl mt-0.5">
              {post.ticket_price === 0 ? "FREE" : `$${post.ticket_price.toFixed(2)}`}
              {post.ticket_original_price > post.ticket_price && (
                <span className="text-sm font-normal text-muted-foreground line-through ml-2">
                  ${post.ticket_original_price.toFixed(2)}
                </span>
              )}
            </p>
          </div>
          {post.ticket_link && (
            <TicketLinkButton
              href={post.ticket_link}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-4 text-sm font-semibold rounded-md bg-primary text-white shadow-md hover:bg-primary/90 glow-lime transition-colors"
            >
              <Ticket className="w-3.5 h-3.5" /> Get Ticket
            </TicketLinkButton>
          )}
        </div>
      )}

      {/* ── Raffle ── */}
      {post.type === "raffle" && raffle && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-yellow-400/8 border border-yellow-400/20 space-y-2.5">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="font-bold text-sm leading-tight">{raffle.prize_title}</p>
          </div>
          {raffle.prize_description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{raffle.prize_description}</p>
          )}
          <p className="text-[11px] font-mono text-muted-foreground">
            {raffle.entries?.length || 0} entries · {raffle.num_winners} winner(s)
            {raffle.entry_requirement !== "free" && ` · Must ${raffle.entry_requirement}`}
          </p>
          {raffle.terms_and_conditions && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer text-yellow-400 font-mono hover:underline">View T&Cs</summary>
              <p className="mt-2 whitespace-pre-wrap bg-muted rounded-lg p-2 text-xs">{raffle.terms_and_conditions}</p>
            </details>
          )}
          {raffle.status === "active" && (
            <Button onClick={() => onEnterRaffle(raffle)} size="sm" variant="outline"
              className="border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 gap-1.5 font-display font-bold">
              <Gift className="w-3.5 h-3.5" /> Enter Raffle
            </Button>
          )}
          {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
            <p className="text-xs font-mono text-primary font-bold">🏆 Winner: {raffle.winner_names.join(", ")}</p>
          )}
        </div>
      )}

      {/* ── Actions Bar ── */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-t border-border/30">
        {/* Comment toggle */}
        <button
          onClick={() => onToggleComments(post.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors min-w-[44px] min-h-[44px]"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-mono">{comments[post.id] != null ? comments[post.id].length : (post.comment_count || 0)}</span>
        </button>

        {/* Share */}
        <button
          onClick={() => onShare(post)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors min-h-[44px]"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span className="text-xs hidden sm:inline">Share</span>
        </button>

        <div className="flex-1" />

        {/* Expand/collapse comments */}
        <button
          onClick={() => onToggleComments(post.id)}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors min-h-[44px] min-w-[44px]"
          aria-label={isExpanded ? "Collapse comments" : "Expand comments"}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Comments ── */}
      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/20 px-4 py-4 space-y-4">
          {/* Comment list */}
          {(comments[post.id] || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {(comments[post.id] || []).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {c.author_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0 bg-muted rounded-xl px-3 py-2">
                    <p className="text-xs font-bold mb-0.5">{c.author_name}</p>
                    <p className="text-sm leading-relaxed break-words">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="flex gap-2 pt-1">
            <Input
              value={newComment[post.id] || ""}
              onChange={(e) => onNewCommentChange(post.id, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmitComment(post.id)}
              placeholder="Write a comment..."
              className="bg-card border-border/50 text-sm h-9 rounded-xl"
            />
            <Button
              size="sm"
              className="h-9 px-4 font-display font-bold rounded-xl shrink-0"
              onClick={() => onSubmitComment(post.id)}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}