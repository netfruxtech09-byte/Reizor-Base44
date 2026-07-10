import { base44 } from "@/api/base44Client";

// Fan signup onboarding guide (Profile → Following / Feed / My Prizes explainer)
export async function markFanOnboardingSeen() {
  await base44.auth.updateMe({ has_seen_fan_onboarding_guide: true }).catch(() => {});
}

// Prize-claiming guide (shown after first activation/giveaway/raffle/poll participation)
export async function markPrizeGuideSeen() {
  await base44.auth.updateMe({ has_seen_prize_claim_guide: true }).catch(() => {});
}

/**
 * Call right after a fan successfully participates in a giveaway/raffle/poll.
 * Shows the prize-claim guide only the first time — never for users who
 * haven't just participated, and never more than once.
 */
export function maybeTriggerPrizeGuide(user, setShow) {
  if (!user || user.role !== "user") return;
  if (user.has_seen_prize_claim_guide) return;
  setShow(true);
}