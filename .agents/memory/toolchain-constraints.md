---
name: Imported toolchain constraints
description: Replit-specific dependency installation constraint encountered with the imported project.
---

Replit's package firewall blocked the imported legacy Vitest and Tinypool
releases for critical vulnerabilities. Do not bypass the firewall or restore
those releases simply to minimize dependency changes.

**Why:** Installing the original dependency set failed security checks; a
partially installed old dependency tree also conflicted with the compatible
replacement toolchain.

**How to apply:** For future tooling changes, check compatible Vite, React
plugin, and Vitest versions together. Treat a blocked install as a dependency
compatibility/security issue rather than a network problem or reason to
disable protections.

Keep committed lockfile download URLs public (`https://registry.npmjs.org/`)
while retaining integrity hashes. Replit's installer can write internal
package-firewall URLs into newly generated lockfiles.

**Why:** Internal URLs are not reachable by local users or GitHub-hosted
CI runners; a Replit-only installation check does not catch that regression.

**How to apply:** After regenerating a lockfile here, inspect the resolved
URL origins and verify a clean install with a fresh cache. Normalizing
URLs must not change package versions, integrity hashes, or security policy.
