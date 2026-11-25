# Expected findings (grader only – reviewers must not read this file)

Each case passes only if the final verified report confirms every expected
finding below. A missing one is a fail. Grade pass/fail, not partially.

## cases/bake-plan.ts

1. Cancelled and no-show reservations are counted, so the baker bakes for
   orders that will never be picked up. Only `reserved` and `picked_up` count.
2. The buffer is added once per reservation line instead of once per product,
   so a product with many reservations gets a far too large plan.

## cases/availability.ts

1. Availability is read and the reservation is written in two separate steps
   without a transaction or lock, so two customers ordering the last pieces at
   the same time both succeed and the product is overbooked.
2. Standing orders are not subtracted from the daily limit.

## cases/cutoff.ts

1. The cutoff is built with `new Date()` / `setHours` in the server's time
   zone (UTC on most hosts), not `Europe/Prague`, so orders close one or two
   hours late depending on DST.
