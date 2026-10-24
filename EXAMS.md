# Course exams

Inside a course, choose **ข้อสอบ → สร้างข้อสอบ**. Each exam can mix up to 50
single-answer multiple-choice questions (2–6 options) and numeric questions.
Every published question needs a text prompt; a PNG, JPG or WebP image up to
5 MiB is optional. Questions can be reordered, removed, and assigned 1–100
points. Numeric answers accept decimal or scientific notation, negative values
and Thai digits. The owner can set an absolute tolerance (default 0).

Save unfinished work with **เปิดให้นักเรียนทำข้อสอบ** unchecked. Publishing
validates all prompts, choices, keys and image ownership. Students use the same
course access rules as videos and documents. The owner alone can author exams
and inspect the latest 200 submissions per exam. Changing an exam increments
its revision; stale submissions are rejected and existing results keep their
original grading snapshot. Closing an exam hides it and its result access from
students until it is reopened.

Grading happens on the server. The student question response omits answer keys,
tolerances and explanations. By default submission responses show the total
score only. **แสดงเฉลยหลังส่งคำตอบ** also reveals individual marking, correct
answers and explanations in submitted results. Turning this off hides those
details on subsequent reads. Teacher test submissions return a preview without
adding a student attempt. Student retakes are allowed and each submission is
saved; repeated network delivery of the same attempt ID is idempotent.

Images are stored in the existing private R2 binding. Uploads require the owner,
validate the file signature, and bound the stream to 5 MiB. Images are served
through an authenticated route and checked against course permission and a
published exam reference. Draft/unattached images are visible only to the owner.
Removing an image from a question removes the reference; the uploaded object is
retained so saved attempts and owner records are not destructively purged.

Data is stored in the added `exams`, `exam_images`, and `exam_attempts` D1 tables.
The appended migration leaves existing courses, accounts, uploads and school
suggestions intact. The browser warns when leaving unsaved questions or answers;
unfinished student answers are held only on the current page, not across reloads.

Validation after a production build:

```sh
node --test tests/*.test.mjs
node tests/exam-integration.mjs
node tests/auth-integration.mjs
```
