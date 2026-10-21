---
name: Playwright on Replit Nix
description: Chromium launch failures caused by Nix-store shared libraries not being on the dynamic loader path.
---

When Playwright installs Chromium in a Replit Nix environment, the browser may fail to launch because `libgbm.so.1` is present in the Nix store but is not on `LD_LIBRARY_PATH`. The application browser journey adds the installed `mesa-libgbm` library directory when present; GitHub Actions instead installs Chromium and its system dependencies through Playwright.

**Why:** The browser downloaded correctly, but Playwright still reported `libgbm.so.1` missing until its Nix-store directory was added to the loader path.

**How to apply:** If Chromium launch reports missing shared libraries on Replit, check the Nix package and loader path before retrying downloads or using apt. Keep CI dependency installation separate from the local Nix setup.
