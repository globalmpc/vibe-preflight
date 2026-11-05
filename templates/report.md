# Is <app name> ready for real users?

<!-- Written for the owner, who may have built the app by chatting with an AI.
     No codes, versions, line numbers or commands unless the owner must use them themselves.
     Every unavoidable term is explained in the same sentence. Fits on about two screens. -->

**Short answer:** <one plain sentence. Example: "Not yet — 3 problems could let a stranger take over your app or its data. Most are quick to fix.">

<!-- Only if there was a previous check: -->
**Since the last check:** <e.g. "2 problems fixed (the admin password and the open database), 1 new one found.">

| Must fix first | Worth fixing soon | Already done well |
| --- | --- | --- |
| <n> | <n> | <n> |

## Fix these first

<!-- RED findings only, at most 5, most damaging first. Number 1 here = R1 in details.md, 2 = R2, and so on.
     Any RED beyond the fifth goes at the top of "Also worth fixing". -->

### 1. <What could happen, in everyday words>

**In simple terms:** <two or three short sentences: what is wrong and what someone could do with it. No jargon.>

**I can fix this for you:** <what the agent will change, in plain words>. <Effort, e.g. "About 5 minutes, then you redeploy the app.">

**You need to do this yourself:** <only if needed — numbered steps, saying where to do each one>
1. <step>
2. <step>

<!-- Example of the expected tone:

### 1. A known flaw in your app's framework lets strangers take over your server

**In simple terms:** Your app is built on Next.js. A serious flaw in the version you use was
made public recently, and attackers move fast on public flaws. Someone who uses it could
control your server and read every password your app relies on.

**I can fix this for you:** update Next.js to the safe version. About 5 minutes; after that
you redeploy the app.

### 2. There's a hidden admin account, and its password is written in your code

**In simple terms:** Your setup script creates an all-powerful admin account, and its
password sits in plain text in your code. Anyone who has seen the code can log in as that
admin.

**You need to do this today:**
1. Log in to your live app with that admin account.
2. Change its password to a new, long one — or disable the account.

**Then I can:** remove the password from the code so future setups don't create it.
-->

## Also worth fixing

<!-- Everything else, one plain line each: what could happen + who fixes it. -->

- <e.g. "Your database has no automatic backups — one bad command or disk failure loses every grade. (Needs a decision: where to keep the copies.)">
- <e.g. "A login library you use is a few updates behind on security fixes. (I can fix this.)">

## Already done well

<!-- At most 5, the ones a beginner cares about. -->

- <e.g. "Every page and API that shows private data requires a login.">

## Worth double-checking

<!-- Every `ask owner` row from the coverage table, as a question the owner can answer,
     plus "ask whoever set up your server about …". -->

- <e.g. "Can anyone see your Docker Hub page without logging in? If yes, tell me — it changes how urgent problem 2 is.">

## What I couldn't check

- <plain reason, e.g. "Your live server — I only read the code on this computer.">

---

**What next?** Tell me which problems to fix (for example "fix 1 and 3"), or "fix everything you can". The full technical notes for whoever does the fixing are in `details.md`.
