# Is TaskNote ready for real users?

**Short answer:** Not yet. 13 problems could let a stranger take over your database, your accounts or your OpenAI bill. Most are quick to fix, but several keys must be replaced because they are already exposed.

| Must fix first | Worth fixing soon | Already done well |
| --- | --- | --- |
| 13 | 12 | 8 |

The five below are the worst. The other 8 "must fix" items are in the next section, one line each.

## Fix these first

### 1. Your database is open to the whole internet

**In simple terms:** Your setup lets anyone on the internet connect to your database. Server firewalls don't stop this with Docker. Combined with problem 2, a stranger could copy or erase everything.

**I can fix this for you:** close the database to the outside; only your app will be able to reach it. About 5 minutes, then you redeploy.

**You need to do this yourself:** after redeploying, ask whoever manages your server to check that the database can't be reached from another computer.

### 2. Your database password is "postgres", written in a file anyone with your code can read

**In simple terms:** That is the example password everyone knows, and it sits in your code.

**I can fix this for you:** make the app read a strong password from a private file on the server instead of the code.

**You need to do this yourself:**
1. Choose a long random password.
2. Change it on your live database (it is not enough to change the file), and put it in the private file on the server.

### 3. Your secret keys are saved in your code history

**In simple terms:** A file named `.env` holds your OpenAI key, your Stripe key and your passwords, and it has been saved into your project's history. Anyone who has ever seen the code can spend your OpenAI money. Deleting the file later does not remove it from the history.

**I can fix this for you:** stop tracking the file, make sure it can't be saved again, and add a blank template listing which settings the app needs. About 5 minutes.

**You need to do this yourself:**
1. In your OpenAI account, delete the current key and create a new one.
2. In Stripe, roll (replace) your secret key.
3. Put the new keys only on your server, never in the code.

### 4. Anyone can pretend to be any user

**In simple terms:** Your login system locks sessions with a secret word, and yours is "changeme". Someone who knows it can create a fake login for any account, admin included, without a password.

**I can fix this for you:** make the app refuse to start without a strong secret.

**You need to do this yourself:** generate a long random secret and put it on your server. Everyone will be logged out once.

### 5. Anyone can give themselves a free "Pro" plan

**In simple terms:** Stripe tells your app when someone has paid. Your app believes any message that claims this, without checking it really came from Stripe. A stranger could send fake "I paid" messages.

**I can fix this for you:** check Stripe's signature on every message. About 15 minutes.

**You need to do this yourself:** in your Stripe dashboard, create the webhook (the address Stripe calls) and copy its signing secret to your server.

## Also worth fixing

Must-fix:

- Any logged-in user can read or delete other people's notes by changing the number in the address. (I can fix this.)
- The AI summary button works for people who aren't logged in and has no limit, so a script could run up your OpenAI bill. (I can fix this; you should also set a spending cap in your OpenAI account.)
- A built-in admin account uses the password "admin123". (I can fix the script; you need to check your live app and change or delete that account.)
- Your version of Next.js is flagged by its publisher as having a security problem. (I can upgrade it; I could not look up how serious it is, so treat it as urgent.)
- Logins travel without encryption (no https). (I can add it; you need a domain name pointing at your server.)
- Your keys are copied into the packaged app image. (I can fix this.)
- The packaged app runs in "development mode", which is slow and reveals too much. (I can fix this.)
- Your database has no permanent storage, so recreating it empties it. (I can fix this; back up the live data first.)

Worth fixing soon:

- The AI button accepts text of any size. (I can fix this.)
- Login has no protection against password guessing. (I can fix this.)
- The app image is larger and less safe than needed. (I can fix this.)
- The app doesn't restart after a server reboot, may start before the database is ready, and its logs can fill the disk. (I can fix this.)
- The database address points to the wrong place when run in Docker, and no database setup steps are saved. (I can fix this.)
- No instructions for setting the app up from scratch, no list of settings, no tests, and no saved package versions. (I can fix this.)
- No backups of your data. (Needs a decision: where to keep copies.)
- No health check and no memory limits. (I can fix this.)
- Smaller items are in `details.md`.

## Already done well

- Passwords are stored scrambled (hashed), not readable.
- Database access uses the safe method, so strangers can't sneak in commands.
- No secret key is sent to visitors' browsers.
- All the packages you use are real, well-known ones.
- Package versions are fixed, not floating.

## Worth double-checking

- Did you ever run the setup script on your live server? If so, the admin account "admin@tasknote.app" exists there; change its password or delete it.
- Is the code, or an app image, stored anywhere others can see (GitHub, Docker Hub)? If yes, replacing the keys in problem 3 is urgent.
- Is your live site opened with https:// and a padlock? If yes, tell me; it changes one item above.
- Are the keys on your server the same as in your code? They should be different from now on.
- Could your notes contain health, money or children's information? If yes, backups become more important.
- How do new users sign up? I found no sign-up in the code.

## What I couldn't check

- Your live server; I only read the code on this computer.
- A full scan for known flaws in your other packages: the security database was unreachable from here, and there's no saved package list to scan.

---

**What next?** Tell me which problems to fix (for example "fix 1 and 3"), or "fix everything you can". The full technical notes for whoever does the fixing are in `details.md`.
