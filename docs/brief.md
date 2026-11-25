# Brief

The original request. Everything else in `docs/` is derived from it.

> **Solution for a small bakery**
>
> The owner of a small bakery says: "People call in to reserve bread and
> pastries. Managing the reservations and working out what to bake takes us a
> lot of time."
>
> Build a solution for them.

## What the owner actually needs

The owner asked for help managing reservations. The two real costs behind
that request are:

1. **Time on the phone.** Every reservation is a call, written down by hand.
2. **Not knowing what to bake.** Someone adds up the notebook every evening,
   which is slow and leads to waste or shortages.

So the goal is fewer calls, faster entry for the calls that remain, and a
bake plan the baker never has to work out by hand.

## Assumptions (to confirm with the owner on day one)

| Assumption | Why it matters |
| --- | --- |
| One shop, 10–40 products, tens of reservations a day | No multi-branch, no scaling work |
| Reservations are for pickup, usually the next day, paid in the shop | No payments, no e-shop |
| Orders close at a cutoff (default: day before at 18:00) | The baker needs a final plan in the evening |
| Some customers will keep calling (older people) | Fast staff entry matters as much as the online form |
| The bakery also bakes for walk-in sales | Plan = reservations + a buffer per product |
| Regulars (cafés, canteens) order the same thing every week | Standing orders remove the most calls |
| Staff use a tablet or laptop by the phone; the baker wants paper | Touch-friendly UI and a print view |
