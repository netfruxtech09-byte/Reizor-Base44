export const EMAIL_TEMPLATES = {
  cart_abandonment: {
    name: "Cart Abandonment",
    subject_line: "You left something behind! 🛒 Complete your {{event_name}} ticket purchase",
    email_body: `Hi {{attendee_name}},

We noticed you left without completing your {{event_name}} ticket purchase. Don't miss out!

Your cart expires in 24 hours. Click below to complete your order:
{{cta_button: Complete Purchase}}

Questions? Reply to this email or visit our support page.

See you there!
{{organizer_name}}`,
    delay_minutes: 30,
    description: "Send to users who added tickets to cart but didn't checkout"
  },
  post_event_thank_you: {
    name: "Post-Event Thank You",
    subject_line: "Thanks for coming to {{event_name}}! 🎉",
    email_body: `Hi {{attendee_name}},

What an amazing event! We had a blast and hope you did too.

Thanks for being part of {{event_name}} on {{event_date}}. We'd love to hear your feedback:
{{cta_button: Leave a Review}}

Stay tuned for upcoming events by {{organizer_name}}. Don't miss the next one!

Best,
{{organizer_name}}`,
    delay_minutes: 1440,
    description: "Send 24 hours after event to ticket holders"
  },
  upcoming_event_reminder: {
    name: "Upcoming Event Reminder",
    subject_line: "{{event_name}} is coming up! {{days_until}} days away ⏰",
    email_body: `Hi {{attendee_name}},

Your event is almost here! 

📅 {{event_name}}
📍 {{venue_name}}, {{city}}
🕐 {{event_date}} at {{doors_open}}

Don't forget:
• Your tickets are ready in your account
• Arrive early for best entry
• Check our parking & accessibility info

See you soon!
{{organizer_name}}`,
    delay_minutes: 0,
    description: "Remind ticket holders before the event"
  },
  re_engagement: {
    name: "Re-engagement",
    subject_line: "Miss {{organizer_name}}? New events coming your way! 🎪",
    email_body: `Hi {{attendee_name}},

It's been a while! We have some exciting new events coming up that we think you'll love.

Check out what's new:
{{cta_button: Browse Events}}

Still want to stay in the loop?
{{cta_button: View All Events}}

Can't wait to see you again!
{{organizer_name}}`,
    delay_minutes: 0,
    description: "Send to previous attendees who haven't bought tickets recently"
  },
  new_event_announcement: {
    name: "New Event Coming Up",
    subject_line: "🎉 {{event_name}} is coming to {{city}} — Get your tickets now!",
    email_body: `Hi {{attendee_name}},

We have an exciting new event coming up and we'd love to see you there!

🎪 {{event_name}}
📅 {{event_date}}
📍 {{venue_name}}, {{city}}

Tickets are on sale now — grab yours before they sell out:
{{cta_button: Get Tickets}}

We can't wait to see you there!

{{organizer_name}}`,
    delay_minutes: 0,
    description: "Announce a new event to all platform users (optionally filtered by location)"
  },
  custom: {
    name: "Custom Campaign",
    subject_line: "Your subject here",
    email_body: "Your email body here with {{dynamic_fields}}",
    delay_minutes: 0,
    description: "Create your own custom email campaign"
  }
};