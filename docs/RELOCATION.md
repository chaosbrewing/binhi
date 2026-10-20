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

## Owner steps (repository creation needs an organisation owner)

1. Create an empty **private** repository `chaosbrewing/binhi` on GitHub
   (no README, no licence, no `.gitignore` — the export already has them).
2. Push the export branch into it as `main`:

   ```bash
   git clone --branch binhi-standalone-export --single-branch git@github.com:chaosbrewing/Tala.git binhi
   cd binhi
   git remote remove origin
   git remote add origin git@github.com:chaosbrewing/binhi.git
   git branch -M main
   git push -u origin main
   ```

3. In the new repository: enable Actions (the CI workflow runs on push),
   protect `main`, and install the Claude GitHub App if it should be used
   there.
4. Verify: `npm ci && npm run typecheck && npm test && npm run build`
   (tests need `BINHI_TEST_DATABASE_URL`).
5. Only after step 4 is green: remove `apps/binhi`, the BINHI CI workflow
   and the README note from Tala in a separate, reviewed pull request, and
   delete the `binhi-standalone-export` branch.

## Why not create the repository automatically

The GitHub access available to the development session is scoped to
`chaosbrewing/ORIGIN` and `chaosbrewing/Tala`. Creating repositories in the
organisation is an owner action, so the procedure stops at step 1.
