# AI Autonomy Sample

This repository includes a sample automation loop that demonstrates how an "autonomous" workflow can operate without relying on external AI APIs. The system coordinates triage, file locking, work package generation, validation, and clean-up so that humans (paired with tools such as Copilot or Claude) can make the actual code changes while automation orchestrates the process.

## Branching model

All persistent automation state lives on a dedicated branch named `ai/state`. The main branch only contains scripts, workflows, and documentation. During triage, scheduling, and cleanup, GitHub Actions check out `ai/state`, modify `.ai/queue.json` and `.ai/locks.json`, and push the updated state back to that branch.

Before running the workflows you must create and publish the branch:

```bash
git checkout --orphan ai/state
rm -rf *
git commit --allow-empty -m "Initialize AI state"
git push origin ai/state
git checkout main
```

## Required secrets

Create a repository secret named `GH_TOKEN` that holds a Personal Access Token with the `repo` scope. The workflows use this token to:

- Push changes to the `ai/state` branch
- Apply labels, create comments, and open draft pull requests
- Dispatch auxiliary workflows

The default `GITHUB_TOKEN` is not sufficient because it cannot push to custom branches across multiple workflows.

## Automation loop overview

The workflow is split into the following stages:

```
issue created/edited
        │
        ▼
┌─────────────────────────┐
│ auto-triage workflow    │
│ - classify component    │
│ - label issue           │
│ - queue work item       │
└────────────┬────────────┘
             │
             ▼ (cron every 30 minutes or manual dispatch)
┌─────────────────────────┐
│ scheduler workflow      │
│ - obey parallel limit   │
│ - respect locks         │
│ - create draft PR       │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ draft work PR workflow  │
│ - create work package   │
│ - open draft PR         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ validation + lock check │
│ - enforce file locks    │
│ - run Go/Web tests      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ auto-merge (optional)   │
│ - merges labeled PRs    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ post-merge cleanup      │
│ - unlock files          │
│ - dequeue issue         │
└─────────────────────────┘
```

Slash commands (`/assign-aider`) can reset the queue entry and clear locks if a human wants to take over or restart the work.

## Testing the loop locally

You can exercise the end-to-end process without contacting any AI services:

1. **Create the state branch.** Follow the commands above to publish `ai/state`.
2. **Open an issue using a template.** Choose the appropriate template (bug, feature, or chore) and include component/complexity selections. Within a few seconds the **Auto triage** workflow will:
   - Apply component/complexity/triaged labels
   - Persist a queue entry on `ai/state`
   - Comment a summary on the issue
3. **Run the scheduler manually.** Trigger the **AI scheduler** workflow via the Actions tab. It will:
   - Respect the `parallelAgents` limit from `.ai/config.json`
   - Skip issues blocked by locks
   - Dispatch the `Create Draft Work Package PR` workflow for each available issue
4. **Inspect the draft PR.** When the draft workflow runs you will see:
   - A new branch `ai/issue-<number>` containing `.ai/work/issue-<number>.md`
   - A draft pull request labeled `ai-generated` and `auto-merge`
   - A checklist that humans can use to complete the work
5. **Validate lock enforcement.** Open any other PR that modifies files matching a locked glob (e.g., `web/**`) while a work package is active. The **Lock check** workflow will fail and list the conflicting issue.
6. **Merge the draft PR.** Once the draft PR is ready (after human commits), merge it. The **Post-merge cleanup** workflow removes the queue entry, clears locks, and pushes the updated state to `ai/state`.
7. **Use the slash command if needed.** Comment `/assign-aider` on an issue to return it to the queue and release locks without closing the draft PR.

## Swapping in a real agent later

This sample uses draft pull requests instead of real-time agent execution. When you are ready to integrate a model runner:

1. Replace the `Create Draft Work Package PR` workflow with an agent runner workflow (for example, rename it to `agent-aider.yml`).
2. Reuse the queue/lock infrastructure. The scheduler already marks TODO comments showing where to invoke an agent instead of creating a PR.
3. Update `.ai/config.json` to point each component to the correct agent entry point.

Because the remainder of the system (triage, locking, validation, merge, clean-up) is already automated, inserting a real agent only requires swapping the work-package generation step.
