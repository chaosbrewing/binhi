---
name: Playwright on Replit Nix
description: Chromium launch failures caused by Nix-store shared libraries not being on the dynamic loader path.
---

When Playwright installs Chromium in a Replit Nix environment, the browser may fail to launch because `libgbm.so.1` is present in the Nix store but is not on `LD_LIBRARY_PATH`. The application browser journey adds the installed `mesa-libgbm` library directory when present; GitHub Actions instead installs Chromium and its system dependencies through Playwright.

Having the Playwright package installed does not guarantee its matching browser binaries are present in the workspace cache. Check the expected executable exists before diagnosing a launch failure as an application or shared-library issue.

**Why:** The browser downloaded correctly, but Playwright still reported `libgbm.so.1` missing until its Nix-store directory was added to the loader path.

**How to apply:** For a missing-browser launch error, install the browser version matching the local Playwright package. If the browser exists but launch reports missing shared libraries, check the Nix package and loader path before using apt. Keep CI dependency installation separate from the local Nix setup.
