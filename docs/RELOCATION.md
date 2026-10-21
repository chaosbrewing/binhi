# Relocating BINHI to its own repository

BINHI was developed as the `apps/binhi` workspace of `chaosbrewing/Tala` so
that it could share tooling without sharing code. Its home is a standalone
repository, `chaosbrewing/binhi`. This is the procedure; the history of
`apps/binhi` is preserved.

## What has been prepared

- `git subtree split --prefix=apps/binhi` extracts the four BINHI commits
  into a branch whose root is the BINHI tree.
- On top of that, one "standalone root" commit adds the three files that
  lived at the monorepo root or did not exist yet: `.github/workflows/ci.yml`
  (the BINHI CI job without `--workspace` flags), `package-lock.json`
  (generated in the extracted tree) and `.gitignore`.
- The extracted tree was verified on its own: `npm ci`, typecheck, the full
  test suite, the production build and the browser journey.
- The result is pushed to the Tala remote as the handoff branch
  **`binhi-standalone-export`**. It does not touch `main` or any MAYARI
  branch and can be deleted once the new repository exists.

## Status (2026-10-21)

- `chaosbrewing/binhi` was created by the owner and the verified export was
  pushed to it as `main` (7 commits: the six `apps/binhi` commits plus the
  standalone root commit). GitHub Actions ran the CI workflow on that push.
- `apps/binhi` in Tala is **still present**. It is removed only in a
  separate, reviewed pull request once the new repository's CI is green and
  the owner says so; until then the standalone repository is the place to
  develop and `apps/binhi` is a frozen copy.
- The handoff branch `binhi-standalone-export` on the Tala remote is no
  longer needed and can be deleted.

## Remaining owner steps

1. In `chaosbrewing/binhi`: protect `main`, and install the Claude GitHub
   App if it should be used there.
2. Remove `apps/binhi`, `.github/workflows/binhi-ci.yml` and the README
   note from Tala in a reviewed pull request; delete
   `binhi-standalone-export`.

## How the export was made

```bash
# in the Tala clone
git subtree split --prefix=apps/binhi -b binhi-standalone-history
git clone --branch binhi-standalone-history <tala> export && cd export
# add .github/workflows/ci.yml (workspace-free CI) and run npm install for a lockfile
git commit -m "Standalone repository root"
git push https://github.com/chaosbrewing/binhi HEAD:refs/heads/main
```

Creating the repository itself was an owner action: the development
session's GitHub access was scoped to `chaosbrewing/ORIGIN` and
`chaosbrewing/Tala`.
