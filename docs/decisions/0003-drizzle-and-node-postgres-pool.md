---
status: accepted
date: 2026-11-25
---

# Drizzle ORM over a node-postgres pool

## Context and Problem Statement

The server needs typed queries, versioned migrations and real transactions
(the availability check locks the product's day before inserting). Vercel
functions with Fluid compute reuse warm instances.

## Considered Options

- Drizzle ORM + `pg` Pool attached with `attachDatabasePool` (`@vercel/functions`)
- Drizzle ORM + Neon serverless HTTP driver
- Prisma ORM

## Decision Outcome

Chosen option: "Drizzle + `pg` Pool", because both Vercel and Neon recommend
node-postgres with `attachDatabasePool` on Fluid compute, it supports
interactive transactions and `SELECT … FOR UPDATE`, and the same driver works
against the local Docker Postgres in tests. Drizzle keeps the schema in
TypeScript, generates SQL migrations with drizzle-kit and adds no runtime
engine. The Neon HTTP driver has no interactive transactions.

### Consequences

- Good, because the schema, the queries and their types live in one place.
- Good, because migrations are plain SQL files that are reviewed and committed.
- Bad, because pooled connections must be released before an instance
  suspends; `attachDatabasePool` handles that and must not be removed.

## More Information

- Vercel, connection pools with Fluid compute: https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute
- Neon, connection methods on Vercel: https://neon.com/docs/guides/vercel-connection-methods
- Drizzle ORM, PostgreSQL: https://orm.drizzle.team/docs/get-started-postgresql
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
