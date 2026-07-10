# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

We need review the diff and plan. We have a lot of diff. Need check acceptance criteria from the plan. The plan is the synthesized plan we produced earlier. The diff is the actual code change. We need determine if it satisfies ACs, find bugs/security/missed edge cases, missing tests. Then output review and final verdict line.

We need inspect the diff thoroughly. The diff is huge (60000 chars truncated). We have the first 60000 chars. Need understand what changed. It includes many files: env, convex authHelpers, employeeProfiles, files, forms, hrCases, invitations, members, onboarding.test, scheduling, schema, seed, playwright, frontend pages, etc. This seems broader than just Phase 2 candidate onboarding portal. It includes scheduling changes, member bypass, invitation bypass, etc. We need review against the plan's ACs. The plan focused on onboarding portal. But the diff includes many other changes. We need evaluate if those changes are correct and if they introduce issues.

We need read more of the diff? The diff truncated at 60000 chars. We might need to see remaining changes. We can request more? We have tool to read files? We can maybe use Read to read specific files after diff. But the instruction says review the diff above. It is included. We can use tools to inspect current files if needed. But we need be concrete with line numbers from diff. We can also use grep/diff to see remaining. Since diff truncated, we need see rest. We can run git diff? But we are in review mode; we can use tools to read files or run commands. The environment likely has the repo. We can use Bash to run `git diff --stat` and `git diff` for specific files. But we need not ask user. We can use tools.

Let's use Bash to get diff stats and maybe specific diffs for onboarding pages, router, upload helper, vite config, ApplicationReviewPage. Also need inspect tests. Let's run commands.

We need be careful: The final answer must be a review and verdict. We can use tools to gather info. Let's do that.

First, get the list of changed files and maybe diff for key files. Use `git diff --stat` and `git diff -- src/features/onboarding/pages src/features/hr/pages/ApplicationReviewPage.tsx src/app/router.tsx src/shared/lib/upload.ts vite.config.ts`. Also maybe `git diff -- convex/candidates.ts convex/files.ts`. Let's run.