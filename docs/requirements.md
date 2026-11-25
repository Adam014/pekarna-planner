# Requirements

The brief (`docs/brief.md`) restated as checkable requirements. This file is the
source of truth for scope: if something is not needed for one of these, it is
out of scope.

| #   | Requirement | What it means here |
| --- | --- | --- |
| R1  | Staff record a phone reservation fast | One screen: find customer by phone or name (or create), pick products and quantities, pickup day and time, note. Target under 20 s per call, keyboard and touch friendly |
| R2  | Customers can reserve without calling | Public page via a link, no account: name, phone, products, pickup day. Respects the cutoff and each product's daily limit. Confirmation page with a short code |
| R3  | Know what to bake | Bake plan for a day per product = reserved quantity + standing orders + buffer. Computed on the server, unit tested, with a clean print view for the baker |
| R4  | Hand out reservations | Today's pickups sorted by time; mark picked up, no-show or cancelled |
| R5  | Manage products | Name, price, daily limit, buffer (pieces), days of the week it is baked, active flag |
| R6  | Standing orders | Regular customer + products + weekdays; they flow into the bake plan and pickups automatically |
| R7  | Running link and login | Deployed app, two demo accounts (staff, owner), seeded realistic data so the plan is not empty |
| R8  | Explain the thinking | README: problem, assumptions, what is built, what is left out and why, next steps, how AI was used |
| R9  | (Stretch) Draft from a message | Paste an SMS or e-mail, an LLM drafts a reservation, staff review and confirm. Never saved without a human |

## Out of scope (on purpose)

Online payments, ingredient stock, multiple shops, accounting, a native mobile
app, an AI phone agent answering calls. None of them saves the owner the time
they asked about, and the phone agent is costly and unreliable for a small
bakery whose callers are often older people.

Overall: small, finished and reliable beats large and half-done.
