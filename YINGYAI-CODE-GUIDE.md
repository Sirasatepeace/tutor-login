# Yingyai Classroom — source guide

This repository contains the application source for Yingyai Classroom. It uses
React/TypeScript and Vinext on Cloudflare Workers. Structured records are in D1
(`DB`); private lesson videos and PDFs are in R2 (`BUCKET`).

## Main files

| File | Responsibility |
| --- | --- |
| `app/accounts.tsx` | Login, student registration, instructor account management and login history |
| `lib/name-policy.mjs`, `app/name-fields.tsx` and `app/name-correction.tsx` | Name screening, instructor review and student corrections; see `NAME-REVIEW.md` |
| `app/classroom.tsx` | Courses, lessons, notices, documents, upload queue and enrollment management |
| `app/api/auth/route.ts` | Registration, login, owner-only account creation, password resets and suspension |
| `app/api/classroom/route.ts` | Course listing, visibility, lessons, enrollment and progress |
| `app/api/media/[id]/route.ts` | Authorized video/PDF delivery and video byte ranges |
| `app/api/upload/route.ts` | Instructor-only multipart uploads |
| `lib/server.ts` | Session identity, owner authorization and course access checks |
| `app/owner-assistant.tsx` and `app/api/assistant/route.ts` | Owner reports, history and optional OpenAI assistant |
| `app/api/activity/route.ts` | Authenticated student activity and Thai-day page-view counts |
| `lib/assistant-reports.ts` | Allowlisted read-only report queries; see `ASSISTANT.md` |
| `lib/password.mjs` | Password hashing, username rules and protected session cookies |
| `db/schema.ts` and `drizzle/` | Schema and ordered database migrations |
| `.openai/hosting.json` | Existing Site identity and storage binding names |

## Current account and course behavior

- A visitor registers with a username, password, first and last names, nickname, class and
  school. Passwords must be 12–128 characters. Usernames are case-insensitive.
- Invalid name characters are rejected. Suspicious names, placeholders and
  inappropriate expressions show red warnings; confirmed submissions wait for
  instructor approval before accessing course content. Normal names, including
  normal corrections, are accepted automatically.
- Registration always creates a new student account. It cannot select the owner,
  impersonate an existing account, or grant course access.
- After registration the student logs in normally. The instructor sees their
  profile in account management and remains the only person who resets passwords,
  suspends accounts or assigns course access.
- A published `restricted` course is visible and accessible only to students with
  an active, unexpired enrollment. A published `all` course is available to every
  logged-in, active account. Anonymous visitors still have to log in.
- Unpublished courses remain drafts. Course visibility and access are enforced
  on the server for course metadata, lessons, notices, video/PDF delivery and
  progress, rather than only hiding buttons in the interface.
- Existing courses default to `restricted`. Existing accounts, enrollments,
  notices and media are preserved. The owner's identity is stored in the existing
  `settings` record; registration does not modify it.
- Signup has a per-network rate limit. Student passwords cannot be retrieved;
  the instructor can set replacement passwords.

## Develop and verify

Use Node.js 22.13 or newer and install the locked dependencies according to
`README.md`. No new packages were added for registration or course visibility.

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/*.test.mjs
npm run build
node tests/auth-integration.mjs
```

The integration test creates an isolated local database and bucket. It tests
legacy-data migration, self-registration, owner-only permissions, course
visibility and direct media access, as well as the existing upload/session flows.
It does not write to production data.

## Continue with another developer or AI

Provide the whole source folder or import its GitHub repository. Ask the next
developer to preserve the existing Site identity and the DB/R2 connections while
making changes. A source-code export does not include student records, password
hashes, runtime secrets, videos or PDFs. Moving the application to another host
requires arranging those resources separately.

Apply schema changes through new migrations. Migration `0003` adds student
profile fields and course visibility, and safely handles the lesson notices
table that previous versions created during requests. Never rerun migrations
against a populated production database without checking migration history.
