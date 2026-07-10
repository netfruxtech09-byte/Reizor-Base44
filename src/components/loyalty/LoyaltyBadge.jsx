export const TIERS = [
  { min: 0,  label: "Fan",        emoji: "🎵", color: "text-muted-foreground",  bg: "bg-muted" },
  { min: 3,  label: "Regular",    emoji: "🎶", color: "text-blue-400",           bg: "bg-blue-400/10" },
  { min: 10, label: "Super Fan",  emoji: "⚡", color: "text-primary",            bg: "bg-primary/10" },
  { min: 25, label: "Legend",     emoji: "👑", color: "text-yellow-400",         bg: "bg-yellow-400/10" },
];

export function getTier(attendedCount) {
  return [...TIERS].reverse().find((t) => attendedCount >= t.min) || TIERS[0];
}

export default function LoyaltyBadge({ attendedCount, size = "sm" }) {
  const tier = getTier(attendedCount);
  const textSize = size === "lg" ? "text-sm" : "text-[10px]";
  const padding = size === "lg" ? "px-3 py-1.5" : "px-2 py-0.5";

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold rounded-full border border-current/20 ${textSize} ${padding} ${tier.color} ${tier.bg}`}>
      {tier.emoji} {tier.label}
    </span>
  );
}