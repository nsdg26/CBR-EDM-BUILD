# Moving the admin to admin.cbrdance.org

This moves the admin panel from `cbrdance.org/admin` to its own address,
`admin.cbrdance.org`, so the admin app and the public CBR DANCE app can
both be installed on the same phone.

**Why:** while the admin shares a domain with the public site, the public
app "owns" every page on that domain, `/admin` included. With the public
app installed, Android Chrome won't offer to install the admin app. On its
own address, the admin is a separate website as far as the phone is
concerned, so both install.

**Nothing changes until step 4.** The code is already live-safe: until you
flip the switch in step 4, `cbrdance.org/admin` keeps working exactly as it
does now. You can do steps 1 to 3 whenever suits and stop there as long as
you like.

Time needed: about 15 minutes, plus a few minutes' wait in step 1.

---

## Step 1: Add the address to the Worker

1. Log in to the Cloudflare dashboard.
2. Go to **Workers & Pages** and open the Worker called **cbr-edm**.
3. Open **Settings**, then **Domains & Routes**.
4. Click **Add**, choose **Custom domain**, and enter:

   ```
   admin.cbrdance.org
   ```

5. Save. Cloudflare creates the DNS record and a certificate for it
   automatically. This can take a few minutes; the entry shows as active
   when it's ready.

## Step 2: Add the address to the existing Access login

**Important:** add it to the application you already have. Do **not**
create a new Access application. The site only accepts sign-ins from the
existing one (it checks the application's AUD tag), so sign-ins from a new
application would be refused with "Forbidden".

1. In the Cloudflare dashboard, go to **Zero Trust**.
2. Go to **Access**, then **Applications**.
3. Open the application that already protects `cbrdance.org/admin` (it
   also covers `cbredm.org/admin`) and choose to edit or configure it.
4. Where its hostnames (domains) are listed, add another one:

   | Field     | Value          |
   |-----------|----------------|
   | Subdomain | `admin`        |
   | Domain    | `cbrdance.org` |
   | Path      | `admin`        |

5. Save.

Use the path `admin`, the same as the existing hostnames, rather than
protecting the whole of `admin.cbrdance.org`. That keeps the app's
install details and icons reachable, which a phone needs to install it.
The admin pages themselves are still protected, both by Access and by the
site's own check.

## Step 3: Test it

1. Open **https://admin.cbrdance.org** in your browser.
2. It should send you to the Access sign-in, then to the admin queue.
3. Click around: Events, Changes, Messages. **View the site** should take
   you to cbrdance.org.
4. On your phone, open https://admin.cbrdance.org and install the admin
   app:
   - **Android (Chrome):** use the **Install** button on the queue page,
     or menu, then **Install app**.
   - **iPhone (Safari):** Share, then **Add to Home Screen**.

   If you have an older CBR ADMIN app installed from cbredm.org, delete it
   and use the new one.

At this point both addresses work: the old `cbrdance.org/admin` and the
new `admin.cbrdance.org`. You can stay here as long as you like.

If anything goes wrong, see **Troubleshooting** below. Nothing in steps 1
to 3 affects the public site or the old admin address.

## Step 4: Switch over

This makes the old admin addresses redirect to the new one.

**Easiest:** ask Claude in a session on `nsdg26/CBR-EDM-BUILD`:

> Turn on the admin subdomain switch: set ADMIN_HOST to admin.cbrdance.org
> and send it to main.

**Or by hand:** in `wrangler.jsonc`, find this line under `"vars"`:

```jsonc
"ADMIN_HOST": ""
```

and change it to:

```jsonc
"ADMIN_HOST": "admin.cbrdance.org"
```

Then, either way, deploy it as usual: run `scripts/sync-to-cbrdance.sh`
from your `CBRDANCE` folder to push it to `nic-st/cbrdance`.

Once it's live, `cbrdance.org/admin` and `cbredm.org/admin` (and any page
under them) redirect to the same page on `admin.cbrdance.org`, and old
bookmarks and email links keep working.

### Undoing the switch

Set `ADMIN_HOST` back to `""` and deploy again. The redirect is the
temporary kind, which browsers don't remember, so the old address works
again straight away. `admin.cbrdance.org` keeps working either way.

---

## Troubleshooting

**"Forbidden" on admin.cbrdance.org after signing in.**
The address was most likely added to a new Access application instead of
the existing one (step 2). Remove it from the new application, delete
that application if you made it just for this, and add the address to the
original one.

**"This site can't be reached" or a certificate warning.**
The custom domain from step 1 isn't active yet. Wait a few minutes and
check it shows as active under the Worker's **Domains & Routes**.

**You're never asked to sign in, or you land on the public board.**
Check the hostname in step 2 has the path `admin`, and that you opened
`https://admin.cbrdance.org` (which goes to `/admin`) rather than a page
of the public site.

**The Install button doesn't appear on Android.**
Make sure you're on `admin.cbrdance.org`, not `cbrdance.org/admin`. If you
dismissed the notice before ("Not now"), use the browser menu instead:
menu, then **Install app**. On iPhone there's never a button; use Share,
then **Add to Home Screen**.

**Something's wrong after step 4.**
Undo the switch (above). The old admin address works again as soon as
that's deployed, and you can fix the setup without time pressure.

---

For the technical detail, see `src/lib/hosts.js` in the repo, and step 14
of the README's owner setup checklist.
