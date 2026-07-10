import { useState, useEffect } from "react";
import { Edit3, Send, Trash2, X, Check, Reply, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

function CommentItem({ comment, currentUser, isOwner, onDelete, onReply, replyingTo, onCancelReply, onSubmitReply }) {
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  // Edit state
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editedReplies, setEditedReplies] = useState({}); // { replyId: { editing, text } }
  const [localComment, setLocalComment] = useState(comment);

  const canModify = currentUser?.email === comment.fan_email || isOwner || currentUser?.role === "admin";

  useEffect(() => {
    if (!comment.id) return;
    base44.entities.PostComment.filter({ parent_comment_id: comment.id, status: "active" }, "created_date", 50)
      .then(setReplies)
      .then(() => setRepliesLoaded(true));
  }, [comment.id]);

  const handleReplySubmit = async (e) => {
    e?.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || trimmed.length > 500) return;
    setReplySubmitting(true);
    const created = await base44.entities.PostComment.create({
      post_id: comment.post_id,
      organizer_id: comment.organizer_id,
      parent_comment_id: comment.id,
      fan_email: currentUser.email,
      fan_name: currentUser.full_name || currentUser.email,
      comment_text: trimmed,
    });
    setReplies(prev => [...prev, created]);
    setReplyText("");
    setReplySubmitting(false);
    onCancelReply();
    toast.success("Reply added");
  };

  const handleStartEdit = () => {
    setEditText(localComment.comment_text);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed.length > 500) return;
    setEditSaving(true);
    await base44.entities.PostComment.update(comment.id, { comment_text: trimmed });
    setLocalComment(prev => ({ ...prev, comment_text: trimmed, updated_date: new Date().toISOString() }));
    setEditing(false);
    setEditSaving(false);
    toast.success("Comment updated");
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditText("");
  };

  // Reply editing handlers
  const handleReplyStartEdit = (reply) => {
    setEditedReplies(prev => ({ ...prev, [reply.id]: { editing: true, text: reply.comment_text } }));
  };

  const handleReplySaveEdit = async (reply) => {
    const state = editedReplies[reply.id];
    const trimmed = (state?.text || "").trim();
    if (!trimmed || trimmed.length > 500) return;
    await base44.entities.PostComment.update(reply.id, { comment_text: trimmed });
    setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, comment_text: trimmed, updated_date: new Date().toISOString() } : r));
    setEditedReplies(prev => { const { [reply.id]: _, ...rest } = prev; return rest; });
    toast.success("Reply updated");
  };

  const handleReplyCancelEdit = (replyId) => {
    setEditedReplies(prev => { const { [replyId]: _, ...rest } = prev; return rest; });
  };

  const isEdited = (c) => c.updated_date && c.updated_date !== c.created_date;

  return (
    <div className="space-y-1.5">
      {/* Main comment */}
      <div className="flex gap-2 group">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">
            {localComment.fan_name?.[0]?.toUpperCase() || "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold truncate">{localComment.fan_name}</span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {localComment.created_date ? format(new Date(localComment.created_date), "MMM d") : ""}
            </span>
            {isEdited(localComment) && (
              <span className="text-[9px] text-muted-foreground/60 font-mono italic">(edited)</span>
            )}
          </div>
          {editing ? (
            <div className="flex gap-2 mt-1">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={500}
                autoFocus
                className="flex-1 bg-transparent border border-primary/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editSaving}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40"
              >
                <Check className="w-3 h-3" />
              </button>
              <button onClick={handleCancelEdit} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <p className="text-sm leading-snug break-words">{localComment.comment_text}</p>
          )}
          {!editing && (
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                title="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
                <span className="font-mono">Reply</span>
              </button>
              {replies.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60 font-mono">{replies.length} repl{replies.length === 1 ? "y" : "ies"}</span>
              )}
              {canModify && (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="font-mono">Edit</span>
                </button>
              )}
            </div>
          )}
        </div>
        {canModify && !editing && (
          <button
            onClick={() => onDelete(comment)}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="ml-9 flex gap-2 pt-1 pb-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            maxLength={500}
            autoFocus
            className="flex-1 bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleReplySubmit}
            disabled={!replyText.trim() || replySubmitting}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40"
          >
            <Send className="w-3 h-3" />
          </button>
          <button onClick={onCancelReply} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Threaded replies */}
      {repliesLoaded && replies.length > 0 && (
        <div className="ml-9 space-y-1.5 border-l-2 border-border/30 pl-3">
          {replies.map((r) => {
            const replyEdit = editedReplies[r.id];
            const replyCanModify = currentUser?.email === r.fan_email || isOwner || currentUser?.role === "admin";
            const replyEdited = isEdited(r);
            return (
            <div key={r.id} className="flex gap-2 group">
              <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-muted-foreground">
                  {r.fan_name?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold truncate">{r.fan_name}</span>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                    {r.created_date ? format(new Date(r.created_date), "MMM d") : ""}
                  </span>
                  {replyEdited && (
                    <span className="text-[8px] text-muted-foreground/60 font-mono italic">(edited)</span>
                  )}
                </div>
                {replyEdit?.editing ? (
                  <div className="flex gap-1.5 mt-0.5">
                    <input
                      value={replyEdit.text}
                      onChange={(e) => setEditedReplies(prev => ({ ...prev, [r.id]: { ...prev[r.id], text: e.target.value } }))}
                      maxLength={500}
                      autoFocus
                      className="flex-1 bg-transparent border border-primary/50 rounded px-2 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handleReplySaveEdit(r)}
                      disabled={!replyEdit.text?.trim()}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-primary text-white disabled:opacity-40"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button onClick={() => handleReplyCancelEdit(r.id)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted">
                      <X className="w-2.5 h-2.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs leading-snug break-words">{r.comment_text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        onClick={() => onReply(comment.id)}
                        className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                        title="Reply"
                      >
                        <Reply className="w-2.5 h-2.5" />
                        <span className="font-mono">Reply</span>
                      </button>
                      {replyCanModify && (
                        <button
                          onClick={() => handleReplyStartEdit(r)}
                          className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span className="font-mono">Edit</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              {replyCanModify && !replyEdit?.editing && (
                <button
                  onClick={() => onDelete(r)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

export default function PostCommentsSection({ postId, organizerId, currentUser, isOwner, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  const loadComments = async () => {
    const all = await base44.entities.PostComment.filter(
      { post_id: postId, status: "active", parent_comment_id: null },
      "-created_date",
      100
    );
    setComments(all);
    // Count all comments (including replies) for the count badge
    const total = await base44.entities.PostComment.filter(
      { post_id: postId, status: "active" },
      null,
      200
    );
    onCountChange?.(total.length);
    setLoading(false);
  };

  useEffect(() => { loadComments(); }, [postId]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;
    setSubmitting(true);
    await base44.entities.PostComment.create({
      post_id: postId,
      organizer_id: organizerId,
      fan_email: currentUser.email,
      fan_name: currentUser.full_name || currentUser.email,
      comment_text: trimmed,
    });
    if (organizerId) {
      base44.functions.invoke("awardLoyaltyPoints", {
        action_type: "comment", owner_type: "organizer", owner_id: organizerId, source_id: postId,
      }).catch((err) => {
        if (err?.response?.data?.error === "follow_required") {
          toast.info(err.response.data.message || "Follow this organizer to earn points.");
        }
      });
    }
    setText("");
    setSubmitting(false);
    await loadComments();
    toast.success("Comment added");
  };

  const handleDelete = async (comment) => {
    await base44.entities.PostComment.update(comment.id, { status: "hidden" });
    await loadComments();
    toast.success("Comment removed");
  };

  if (!currentUser) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="text-primary hover:underline font-bold"
          >
            Sign in
          </button>
          {" "}to leave a comment
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-3">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUser={currentUser}
              isOwner={isOwner}
              onDelete={handleDelete}
              onReply={(id) => setReplyingTo(id)}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onSubmitReply={loadComments}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-border/30">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          className="flex-1 bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}