# Yingyai owner assistant

The **ผู้ช่วย Yingyai** entry is available only in the instructor view, with a
mobile shortcut on the course dashboard. Every assistant operation independently
checks the existing owner identity on the server. Students cannot read report or
conversation endpoints. Existing course and student access is unchanged.

## Reports and activity

Quick reports work without an OpenAI key. They cover activity, registrations,
courses, exams, latest scores per student, current eligible students who have
never submitted, and incorrect-answer rates separated by exam revision. Reports
show their source, date range when applicable, generation time and row limits.
Exam reports link back to the course's exam list. Answers and history are visible
only to the owner and are retained for 90 days. The UI loads the last 30 exchanges.

`site_daily_activity` records visible, authenticated student use independently
of new logins. It excludes the owner, including student-preview mode. Navigation
increments page views; visible-page heartbeats and visibility changes update
activity without adding views. A person using one account on several devices is
one distinct account, not several people. Anonymous visitors are not counted.
Day boundaries use Asia/Bangkok. Activity is retained for 90 days, and the recorded
start date is displayed; there is no retrospective visitor data before that date.
Telemetry is best effort and does not claim to identify unique human visitors.

## OpenAI connection

Production currently has no API key by default. The UI labels this state and
disables free-form AI questions while retaining quick reports. To activate AI,
use the OpenAI Developers plugin's `openai-platform-api-key` skill and its native
approval flow, then set `OPENAI_API_KEY` as a secret using Sites runtime environment
settings and deploy the Site version. Never put a key in source, the browser,
messages, the manifest, D1 or exported files. `OPENAI_MODEL` is optional; the
default is `gpt-6-luna`. The status endpoint reports only whether a key is present;
presence alone does not verify the key, billing or model access.

The server uses `POST https://api.openai.com/v1/responses` with `store: false`,
one strict function tool, a bounded tool loop, timeouts and an output-token cap.
Reports are read from parameterized, allowlisted queries. There is no SQL,
filesystem, browser, mutation, account-management or arbitrary-network tool.
The first model response must request a report. Successful report data is shown
alongside the answer. The model receives the current question, up to six prior
completed exchanges and reports it requests; statistics must be fetched afresh.
Report values and user-controlled titles/names are treated as untrusted data.

AI requests are limited to 8/minute and 100/Thai day per owner, independently
of quick reports. Idempotent request IDs prevent duplicate model calls on a
completed retry. A pending-request guard limits concurrent work; abandoned
pending requests cease to block new requests after two minutes. Limits bound
request volume, not a guaranteed currency amount. API charges are separate.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/*.test.mjs
node /root/.codex/plugins/cache/openai-curated-remote/sites/1.1.0/scripts/build-site.mjs
node tests/assistant-integration.mjs
node tests/exam-integration.mjs
node tests/auth-integration.mjs
```

The assistant tests use isolated Miniflare databases and a fake upstream service.
They do not use production student data, a real API key or paid inference. A live
OpenAI verification remains necessary after connecting the account. Browser UI
verification has not been performed in this environment.
