---
status: accepted
date: 2026-11-25
---

# Reservation data model: orders keep a copy, standing orders create reservations

## Context and Problem Statement

The app stores products, customers, reservations and standing orders (R1–R7).
A standing order is a regular customer's weekly order; its days must show up
in the bake plan and the day's list and be marked like any reservation (R5).
Changing a product, a customer or a standing order must never change what was
ordered on past days.

## Decision Drivers

- Past orders never change, whatever is edited later.
- The plan, availability and the day's list read one table.
- Never sell more than a product's daily limit, also under concurrent orders.
- Simple enough for a small bakery and a demo.
- Invalid data is rejected by Postgres, whatever code writes it.

## Considered Options

- Orders keep a copy; standing orders create reservations ahead
- Orders keep a copy; standing orders computed for each day from the template
- Orders read the product and customer live; standing orders create
  reservations ahead

## Decision Outcome

Chosen option: "Orders keep a copy; standing orders create reservations
ahead", because each order is then a plain row that later edits cannot reach,
and the plan, availability and the day's list only read reservations.

- **Copies:** a reservation keeps the customer's name and phone, and each item
  the product name and unit price, as they were when it was made. Shopify
  keeps the product title and unit price "at time of order creation" the same
  way.
- **Standing orders** are a template: customer, weekdays, time, items. Its
  days are ordinary reservations with `source = 'standing_order'`, created
  28 days ahead when the template is saved, by a daily job (Vercel
  Schedules), and again whenever staff open the bake plan or the day's list,
  so a missed job run fills itself in. Shopify creates "a new order" for each cycle of a subscription
  contract.
- **Editing a template** deletes and recreates only its future `reserved`
  days still before the cutoff; Recharge regenerates upcoming charges after a
  subscription change the same way. Cancelling one day cancels that
  reservation. An ended template is set inactive, never deleted.
- **One reservation per template and day** (unique key), so a job delivered
  twice changes nothing (`ON CONFLICT DO NOTHING`) and a cancelled day is not
  recreated. Vercel says a run can be duplicated or skipped.
- **Booking horizon:** anyone books at most 21 days ahead, so a standing
  order's day exists before other orders for it, even if the job misses runs.
- **Daily limit:** every write that adds demand locks the product rows
  (`SELECT … FOR UPDATE`, sorted by id so two orders cannot deadlock), sums
  the `reserved` and `picked_up` items for the day, and checks the limit
  before inserting. Postgres returns `sum()` as `bigint`, which node-postgres
  reads as a string: cast it.
- **Order link:** an online order has a secret link `/objednavka/[token]`
  with 256 random bits; only its SHA-256 is stored. The page sends no
  `Referer`, is `noindex`, loads no third-party scripts, cancels only by
  `POST`, and the link stops working 30 days after pickup (W3C TAG). The
  device keeps its links in an HttpOnly, Secure, SameSite=Lax cookie, as
  OWASP recommends against tokens in Web Storage.
- **Double submit:** the form sends an idempotency key (UUID), stored with a
  hash of the order. For 24 hours the same key and order return the saved
  reservation with a new link; a different order or a later retry is refused
  (Stripe, IETF draft).
- **Keys and types:** `uuid` from `uuidv7()` (never an access token, RFC 9562
  §8); `date` for pickup days as a `'YYYY-MM-DD'` string; money as `integer`
  haléře; weekdays as `smallint[]`, ISO 1–7; status and source as `text` with
  a `CHECK`, because enum values cannot be removed.
- **Checks:** positive quantities and limits, non-blank names, phones in
  E.164, a phone order names its staff member, only online orders have a
  link, only standing order days lack an idempotency key, one settings row
  that cannot be deleted. Foreign keys `restrict` deletes and are indexed.

### Consequences

- Good, because a past order shows exactly what was ordered, at what price
  and for whom.
- Good, because the daily limit is a sum over one table, with no counter to
  drift, and concurrent orders wait for each other instead of failing.
- Bad, because a daily job runs in addition to the app; if it fails, missing
  days appear only once staff open the bake plan or the day's list.
- Bad, because when a price goes up, standing order days already created keep
  the old price until the template is saved again. This is accepted: a
  standing order is agreed at its price, and nothing is paid online.
- Bad, because changing a product's buffer also changes how a past day's bake
  plan is shown. This is accepted: what was ordered and handed out stays
  exact, and no requirement needs past plans.
- Bad, because whoever the customer gives the order link to can cancel the
  order until the cutoff, and on another phone the customer needs the copied
  link or calls the bakery. This is accepted: the link cannot be guessed,
  and staff see the cancellation on the day's list.

### Confirmation

Constraints in migrations `0001` and `0002`; service tests for creating and
editing standing order days, including a job run twice; an integration test
on real Postgres 18 where twenty concurrent orders for a limit of five sell
exactly five; `review-change` checks new code against this record.

## Pros and Cons of the Options

### Standing orders computed for each day from the template

- Good, because no job and no stored days; calendars compute recurring events
  the same way (RFC 5545 `RRULE`).
- Bad, because marking a single day (picked up, cancelled) and keeping past
  days fixed after an edit need extra tables, and every query and the limit
  check must add the computed days.

### Orders read the product and customer live

- Good, because nothing is stored twice.
- Bad, because renaming or repricing a product, or editing a customer, would
  change what past orders show.

## More Information

- Shopify LineItem (`title`, `originalUnitPriceSet`): https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem
- Shopify subscription contracts: https://shopify.dev/docs/apps/build/purchase-options/subscriptions/contracts
- Recharge charges (regeneration): https://docs.getrecharge.com/docs/charges
- RFC 5545, iCalendar (`RRULE`): https://www.rfc-editor.org/rfc/rfc5545
- Vercel Schedules, concepts (duplicate and skipped runs): https://vercel.com/docs/schedules/concepts
- PostgreSQL 18, explicit locking (lock order, deadlocks): https://www.postgresql.org/docs/18/explicit-locking.html
- PostgreSQL 18, constraints and foreign keys: https://www.postgresql.org/docs/18/ddl-constraints.html
- PostgreSQL 18, `INSERT … ON CONFLICT`: https://www.postgresql.org/docs/18/sql-insert.html
- PostgreSQL 18, `uuidv7()`: https://www.postgresql.org/docs/18/functions-uuid.html
- PostgreSQL 18, `ALTER TYPE` (enum values): https://www.postgresql.org/docs/18/sql-altertype.html
- RFC 9562, UUIDs: https://www.rfc-editor.org/rfc/rfc9562.html
- W3C TAG, Good Practices for Capability URLs: https://www.w3.org/2001/tag/doc/capability-urls/
- OWASP Session Management Cheat Sheet (Web Storage): https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
- IETF Idempotency-Key draft: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
- Research notes (local): `docs/research/reports/standing-orders-as-reservations-2026-11.md`, `database-schema-2026-11.md`, `reservations-concurrency-2026-11.md`, `guest-order-access-2026-11.md`
