# Requirements

The brief (`docs/brief.md`) restated as checkable requirements. This file is the
source of truth for scope: if something is not needed for one of these, it is
out of scope.

| #   | Requirement                                    | What it means here                                                                                                                                                                                                              |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Staff record a phone reservation fast          | "Nová rezervace": find customer by phone (or create), pick products and quantities, pickup day and optional time, note. Staff may book after the cutoff. Target under 20 s per call, keyboard and touch friendly                |
| R2  | Customers can reserve without calling          | The public order form is the root page `/`, no account: products, pickup day (only days still before the cutoff, at most 21 days ahead), name, phone. Respects each product's daily limit. The browser remembers name and phone |
| R3  | Customers can check and cancel without calling | After ordering, `/objednavka/[code]` shows the order and lets the customer cancel it until the cutoff. The link works until 30 days after pickup; the device remembers it (cookie)                                              |
| R4  | Know what to bake                              | "Plán pečení", tomorrow by default: per product = reserved quantity + standing orders + buffer. Computed on the server, unit tested, print view for the baker                                                                   |
| R5  | Hand out reservations                          | "Dnes": reservations for a day (today by default), sorted by time; mark picked up, no-show or cancelled; switch to other days. Staff land here after login                                                                      |
| R6  | Manage products (owner)                        | Name, price, daily limit, buffer (pieces), days of the week it is baked, active flag; the order cutoff time is set on the same page                                                                                             |
| R7  | Standing orders (owner)                        | Regular customer + products + weekdays; they become ordinary reservations 28 days ahead, so they show in the bake plan and the day's list                                                                                       |
| R8  | Login and roles                                | `/prihlaseni`, linked from the order page. Roles `staff` and `owner`, checked on the server. No sign-up; two demo accounts, seeded realistic data so the plan is not empty                                                      |
| R9  | Explain the thinking                           | README: problem, assumptions, what is built, what is left out and why, next steps, how AI was used                                                                                                                              |
| R10 | (Stretch) Draft from a message                 | Paste an SMS or e-mail, an LLM drafts a reservation, staff review and confirm. Never saved without a human                                                                                                                      |

## Out of scope (on purpose)

Online payments, ingredient stock, multiple shops, accounting, a native mobile
app, customer accounts, SMS, pickup time slots, a separate baker account (the
baker prints the plan), an AI phone agent answering calls. None of them saves the owner the time
they asked about, and the phone agent is costly and unreliable for a small
bakery whose callers are often older people.

Overall: small, finished and reliable beats large and half-done.
