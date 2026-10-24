# Student name screening

Registration and instructor-created student accounts use separate **ชื่อจริง**
and **นามสกุล** fields. Unicode letters/marks, spaces, hyphens, apostrophes and
initial periods are supported. Names are normalized to NFC; repeated spaces,
curly apostrophes and name hyphens are normalized without transliterating names.
Each component has a 100-character limit. Numbers, links, emoji, markup and
hidden control/direction characters are rejected by the server.

`lib/name-policy.mjs` contains a small list of unmistakable placeholders and
whole-component offensive expressions. These produce red warnings and require
explicit confirmation to continue into approval waiting. Short offensive substrings are never
matched inside longer names. There is no real-name dictionary or external AI
service, and no promise that all fabricated names can be identified.

Three or more identical consecutive letters (case-insensitive), except that Thai
`น` and `ก` may repeat exactly three times, produce a review hint. Four or more
of either still trigger review; the exception does not bypass other name checks.
Repeated syllables, keyboard sequences, unusual Latin clusters, malformed Thai vowel/mark
order, mixed scripts within a word and identical first/last names are review
hints in either the first name or surname. They do not establish that a name is
fake. The examples `aaa ddd`, `svrnhj`, `กหีำพด`, `wefvev verve` and `อะอะ อุอุง`
trigger review. Latin words of at least four letters without a vowel are flagged;
`y` counts as a vowel and ordinary double letters and internal clusters such as
`Anna Schmidt` remain accepted. Thai screening checks incompatible vowel/mark
order, such as `ีำ`, without requiring a written vowel in names like `พร` or
`กนก`. The same shared rules show red warnings while typing, before both fields
are complete, and run again on the server. A student must explicitly confirm a flagged name
before registering; the resulting account waits for instructor approval before
lessons, media or exams can be accessed. Normal names are accepted automatically.
Public submissions cannot choose their status, flags, owner identity or rights.
Older full-name payloads are parsed and subjected to the same server checks.

## States and review

- `format_ok`: automatically accepted under the current name rules; not identity verified.
- `pending`: flagged signup, or a revised name awaiting instructor review.
- `approved`: explicitly accepted or entered by the instructor.
- `needs_change`: the instructor has requested a correction, with a note.
- `legacy`: the existing name has not been reclassified.

In **บัญชีเข้าสู่ระบบ → ตรวจสอบชื่อผู้เรียน**, the instructor can filter pending
names and open **ตรวจชื่อ**. They may accept a name or request a correction.
Students waiting for approval see a dedicated page, refreshed every 30 seconds,
and can revise their first and last names. A correction that passes screening is
automatically accepted; a correction with remaining flags still waits for review. A dedicated `name_version`
prevents stale browser tabs from approving or overwriting a different name.
Students cannot edit another user, approve themselves, or rewrite an already
approved name without an instructor correction request. Correction attempts are
rate-limited. Names in `people` and existing enrollments follow the canonical
account name; historical exam score data and account ownership are unchanged.

Migration `0006_student_names.sql` adds metadata without rewriting existing
names, student IDs, passwords, sessions, enrollments or learning results. Existing
names remain visible and can be reviewed individually. Migration `0007` accepts
previously corrected pending names whose stored screening flags are empty, while
invalidating stale reviews by increasing their name version. Pending names and
instructor correction requests block all course content at the server, including
public courses, direct media URLs, exams and grading writes. They may still log
in to correct their name. Instructor approval or an automatically accepted
correction unlocks their existing course rights without another login.

Per-course enrollment remains a separate requirement for restricted courses.

Validation includes `tests/name-policy.test.mjs` and the isolated Worker/D1 flow
in `tests/name-integration.mjs`, plus the existing authentication integration.
Browser layout/interaction verification remains unperformed in this environment.
