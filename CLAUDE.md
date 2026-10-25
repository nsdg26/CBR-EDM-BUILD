# Repo / deployment setup

This project lives across two GitHub repos and two accounts, on purpose:

- **`nsdg26/CBR-EDM-BUILD`** — the repo this Claude Code integration is
  connected to (`nsdg26` has the paid Claude/GitHub App link). All Claude
  Code sessions build, fix and commit here. This repo used to be named
  `CBR-EDM`; GitHub redirects the old URL, but the remote should be set to
  the `CBR-EDM-BUILD` name directly rather than relying on the redirect.
- **`nic-st/cbrdance`** — the owner's personal GitHub account. This is the
  repo Cloudflare Workers Builds actually watches for deployment: pushes
  here are what go live. It was originally a fork of the `nsdg26` repo;
  when `nsdg26` was made private, `nic-st` was added as a collaborator on
  it instead (so the fork relationship doesn't reflect current access).

**Workflow:** build and fix things here via Claude on `nsdg26/CBR-EDM-BUILD`
as normal; every PR and push to `main` runs the tests
(`.github/workflows/test.yml`). The owner then carries `main` across to
`nic-st/cbrdance` **by hand** (currently `scripts/sync-to-cbrdance.sh`, see
below) and Cloudflare deploys from there. Pushing to `nsdg26/CBR-EDM-BUILD`'s
`main` does **not** by itself deploy anything; nothing is live until the
owner has synced it to `nic-st/cbrdance`, so after a merge tell them it
still needs syncing rather than saying it will go live on its own.

An automatic sync (a GitHub Actions workflow in `cbrdance` that pulls this
repo's `main` hourly) is written and kept here as `scripts/cbrdance-sync.yml`,
with setup in `scripts/CBRDANCE-SYNC-SETUP.md`, but the owner has **not**
enabled it (owner decision, October 2026: too fiddly to set up for now). If
it is ever switched on, the owner copies that file into `.github/workflows/`
in `cbrdance` whenever it changes.

A Claude Code session can only work with repos under one GitHub account at
a time (no cross-account access in a single session), and the owner keeps
the personal account out of Claude on purpose, so no session can see or
push to `nic-st/cbrdance`. Anything that has to change there is written
here and copied across by the owner.

`scripts/sync-to-cbrdance.sh` is the manual way, and the one in use: run
it locally inside the `CBRDANCE` desktop folder to pull `nsdg26`'s `main`
into `nic-st/cbrdance`'s `main` and push it. It also handles the case the
automatic workflow would refuse, a commit made directly in `cbrdance` that
has to be merged by hand. It also fixes the common failure mode where that
folder's `origin` remote got pointed at the `nsdg26` repo instead of
`nic-st/cbrdance` (which is what makes GitHub Desktop conflate the two
folders and refuse to push).

# Domains

**cbrdance.org is the primary domain, always** (owner decision). The same
Worker also answers on cbredm.org, but anything that behaves differently
between the two is judged on cbrdance.org: check live behaviour there
first, and treat a fix that only works on cbredm.org as not done. Both
domains share one Cloudflare Access application (the same ACCESS_AUD), so
admin sign-in is the same on each; they are still separate origins to a
browser, with separate storage, installed apps and service workers.

The admin panel can also live on its own hostname, **admin.cbrdance.org**
(`src/lib/hosts.js`, README step 14), so the admin app and the public app
can both be installed on one phone. Any `admin.` hostname serves the admin
as soon as it reaches the Worker; `vars.ADMIN_HOST` (empty = off) is the
separate switch that redirects `/admin` on the other domains there. Until
the owner sets that, `/admin` must keep working on cbrdance.org itself.
