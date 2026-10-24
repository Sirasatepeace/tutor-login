# GitHub source workflow

Repository: https://github.com/Sirasatepeace/tutor-login  
Primary branch: `main`  
Live website: https://yingyai-classroom.sacredvine2.chatgpt.site

GitHub repository access was authorized on 2026-10-24 for the initial import.
Use this repository as the primary source for subsequent edits.

The owner has requested that future development be committed to this GitHub
repository. The website continues to run on its existing Sites hosting, with
the existing student database and uploaded media.

## Ask for an update

For example: "Edit my Yingyai Classroom repository Sirasatepeace/tutor-login,
add the feature I describe, and publish it to my existing website."

The development workflow is:

1. Read the latest GitHub `main` source and the current Site source.
2. Make the change, preserving newer work from either source.
3. Run the checks appropriate to the change and build the application.
4. Commit the complete source changes to GitHub.
5. Synchronize that verified source tree to the existing Sites-managed repository
   with the Sites source helper, package it, and publish the saved Site version.
6. Report the GitHub commit and the live website result.

A commit on GitHub stores code and history. It does not automatically change the
live website. GitHub Pages cannot run this application's Worker, private D1
database and R2-backed lessons; keep the existing Sites hosting for this workflow.
No deployment secrets or automatic deployment workflow are stored in GitHub.

## Source snapshot and data

The initial import starts from the existing live Site's version 21, source
commit `f55dce7e6611207c1eea90d2a8434c33dfb33d85`, plus repository documentation
and generated-cache exclusions. It includes application code, static assets,
the lockfile, schema/migrations and automated tests. Earlier Sites history remains
with the existing Site; GitHub history begins with this import.

The repository is public at the time of import. Its source has been checked for
credential patterns. Runtime secrets and private records remain with the hosting
service. This code import is not a backup or migration of student data or lessons.

## Development checks

Use Node.js 22.13 or newer. Install locked dependencies using the Sites skill in
ChatGPT Work, or the repository's package-manager configuration for standalone
development. See `README.md` for the environment setup.

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/*.test.mjs
npm run build
node tests/auth-integration.mjs
node tests/name-integration.mjs
node tests/exam-integration.mjs
node tests/assistant-integration.mjs
```

Build before running integration tests: they execute the compiled Worker. Each
integration test uses its own temporary database/bucket. Choose checks based on
the change; a documentation-only change does not need new application tests.

See `AGENTS.md` for instructions intended for future coding assistants.
