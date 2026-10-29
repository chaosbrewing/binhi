---
name: Raw PostgreSQL JSON with Drizzle
description: Drizzle wrapping a shared postgres-js connection changes JSON serialization expectations for raw SQL.
---

When issuing raw SQL on a postgres-js connection also wrapped by Drizzle,
explicitly JSON.stringify values and cast the bound string to jsonb.
Do not assume postgres-js's json(object) helper still serializes objects.

**Why:** Drizzle's serializer configuration on the shared connection can leave
raw objects unencoded, causing ERR_INVALID_ARG_TYPE even though the same query
works on a standalone postgres-js connection.

**How to apply:** Exercise raw JSON writes through the real application
connection in integration tests, not only standalone database probes.
