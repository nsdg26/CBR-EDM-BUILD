# Syncing to nic-st/cbrdance without the desktop

Why two repos, and which does what, is in [`CLAUDE.md`](../CLAUDE.md).
In short: Claude builds here (`nsdg26/CBR-EDM-BUILD`, the work account),
Cloudflare deploys from `nic-st/cbrdance` (the personal account), and
something has to carry `main` from the first to the second. That used to
be `sync-to-cbrdance.sh`, run by hand on a PC. The GitHub Actions
workflow in [`cbrdance-sync.yml`](cbrdance-sync.yml) does the same job
on GitHub's own machines: hourly, and on demand from a button on the
website, so no PC is involved.

The direction matters. The workflow lives in the personal repo and
*pulls* from the work repo with a read-only token. Nothing belonging to
the personal account is stored in the work account, Cloudflare stays
connected to the personal account only, and the one credential that
crosses the line can read exactly one repository and write nothing.

Everything below is done on github.com. About ten minutes, once.

## 1. Make the read-only token (on the nsdg26 account)

Signed in as `nsdg26`:

1. Settings > Developer settings > Personal access tokens >
   **Fine-grained tokens** > Generate new token.
2. Token name: `cbrdance sync read`. Expiration: the longest offered
   (one year). Put a reminder in your calendar for a week before it
   expires; the workflow fails cleanly when the token dies, it does not
   deploy anything wrong.
3. Resource owner: `nsdg26`.
4. Repository access: **Only select repositories** > `CBR-EDM-BUILD`.
5. Repository permissions: **Contents: Read-only**. (Metadata read-only is
   added automatically.) Nothing else.
6. Generate, and copy the token. It is shown once.

## 2. Store it in the personal repo (on the nic-st account)

Signed in as `nic-st`, in `nic-st/cbrdance`:

1. Settings > Secrets and variables > **Actions** > New repository secret.
2. Name: `UPSTREAM_READ_TOKEN`. Secret: the token from step 1. Save.

## 3. Add the workflow file

Still in `nic-st/cbrdance`:

1. Add file > Create new file. Name it exactly
   `.github/workflows/sync-from-build.yml` (typing the slashes in the name
   box creates the folders).
2. Paste the whole of [`cbrdance-sync.yml`](cbrdance-sync.yml) from this
   repo. Commit straight to `main`.
3. Settings > Actions > General: make sure Actions are allowed for the
   repository (the default for a personal repo). The workflow asks for
   its own write permission in the file, so the "Workflow permissions"
   default can stay at read.

## 4. Run it once and watch

1. Actions tab > **Sync from CBR-EDM-BUILD** > Run workflow > Run.
2. It should finish in under a minute with either "Already up to date"
   or "Pushed". If it pushed, the Worker's Builds page in the Cloudflare
   dashboard shows a new build within a minute, the same as a push from
   the desktop did.

That button is now the "deploy now" button. Without pressing it, the
hourly run picks up anything merged in the build repo within the hour.

## When it fails

The run goes red and the log says why. The two causes worth knowing:

- **"UPSTREAM_READ_TOKEN secret is not set"**, or an authentication
  error on the fetch: the token is missing, expired, or was made on the
  wrong account or for the wrong repository. Redo step 1 and 2.
- **"cbrdance main has commits that are not in CBR-EDM-BUILD main"**:
  someone committed to `cbrdance` directly. The workflow never
  overwrites, so nothing deploys until those commits are either brought
  into the build repo or dropped. The old
  [`sync-to-cbrdance.sh`](sync-to-cbrdance.sh) still works for sorting
  that out on a PC; it is kept for exactly this.

## What this does not change

Pushing to `nsdg26/CBR-EDM-BUILD` `main` still deploys nothing by itself.
The workflow is what moves it across, and Workers Builds on
`nic-st/cbrdance` is still what goes live. Secrets, vars and bindings in
`wrangler.jsonc` ride across with the code as before.
