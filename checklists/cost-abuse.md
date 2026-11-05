# Cost and abuse checklist

Apps built quickly often let one stranger — or one bot — spend the owner's money: LLM
calls, SMS, email, storage, database load. These findings are about the bill and about
the app staying up, not only about data.

## COST-01 Paid API reachable without login — RED

**Look for:** routes or server actions that call a paid service — LLMs (OpenAI, Anthropic,
Gemini, Groq, Mistral, Replicate, Together, OpenRouter), image/voice (ElevenLabs,
Stability), SMS/WhatsApp (Twilio, Vonage, local gateways), email (Resend, SendGrid,
Mailgun, SES), maps/geocoding, scraping APIs — with no auth check.

**Why:** a script can call it thousands of times overnight and the owner pays.

**Fix:** require login; add per-user limits (COST-02).

## COST-02 No per-user limit on paid calls — YELLOW (RED if unauthenticated)

**Check this even when COST-01 passes.** Login stops strangers; it does not stop one
account (or a script using one session) from making thousands of calls.

**Look for:** no rate limiter, quota, credit counter or daily cap around every route or job
that triggers a paid call, for logged-in users too.

The YELLOW level already assumes the routes need a login — do not lower it further with `L-LOGIN`.

**Fix:** rate limit per user and per IP; a daily quota stored in the database; alerts and a
hard spending cap at the provider's dashboard.

## COST-03 Unbounded LLM requests — YELLOW

**Look for:** user input passed to the model with no length limit; no `max_tokens` /
`max_output_tokens`; conversation history sent in full every turn; the model name chosen
by the client.

**Fix:** cap input length, set output token limits, trim history, choose the model on the
server.

## COST-04 Retries and loops without a cap — YELLOW

**Look for:** retry loops around paid or external calls with no maximum or no backoff;
recursive "agent loops" with no step limit; polling without an end.

## COST-05 Lists without pagination — YELLOW

**Look for:** list endpoints that return whole tables (`findMany()` / `.all()` /
`SELECT *` without `take`/`limit`), or let the client set an unlimited page size.

**Why:** fine with 50 rows, takes the server down with 500,000.

**Fix:** default and maximum page size on the server.

## COST-06 Request body and upload size unlimited — YELLOW

**Look for:** body parsers or upload handlers without a size limit (also SEC-11);
server-side image/video processing of arbitrary uploads.

## COST-07 Email / SMS / OTP endpoints open to spam — RED

**Look for:** "send code", "invite", "contact us", "forgot password" routes that send
messages with no rate limit or CAPTCHA, especially to arbitrary addresses or numbers.

**Why:** bots use these to send spam through the owner's account — costly, and the
provider may suspend it.

## COST-08 Expensive work on every request — INFO

**Look for:** database queries inside loops over results (N+1); scheduled jobs running
every few seconds; heavy work (PDF, image, LLM) done synchronously in the request instead
of a background job.
