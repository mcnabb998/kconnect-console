import { dispatchWorkflow, readJson, writeJson } from './gh-helpers.mjs';
import { loadLocks, locksForFiles, saveLocks } from './locksmith.mjs';

const QUEUE_PATH = '.ai/queue.json';
const LOCKS_PATH = '.ai/locks.json';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

async function main() {
  const config = await readJson('.ai/config.json', {});
  const queue = ensureArray(await readJson(QUEUE_PATH, []));
  const locks = ensureArray(await loadLocks(LOCKS_PATH));

  const currentInProgress = queue.filter((item) => item.status === 'in-progress').length;
  const parallelLimit = config.parallelAgents ?? 1;
  let remainingCapacity = Math.max(parallelLimit - currentInProgress, 0);

  if (remainingCapacity <= 0) {
    console.log('No scheduler capacity available.');
    return;
  }

  const scheduledIssues = [];

  for (const item of queue) {
    if (remainingCapacity <= 0) break;
    if (item.status !== 'queued') continue;

    const conflicts = locksForFiles(item.files, locks);
    if (conflicts.length > 0) {
      console.log(`Issue #${item.number} is blocked by existing locks.`);
      continue;
    }

    // TODO: replace draft work package dispatch with direct agent execution.
    await dispatchWorkflow('create-draft-work-pr.yml', 'main', {
      issue_number: String(item.number),
      component: item.component,
      files: (item.files ?? []).join(',')
    });

    item.status = 'in-progress';
    item.started_at = new Date().toISOString();
    locks.push({
      issue: item.number,
      files: item.files ?? [],
      agent: 'human',
      pr: null,
      started_at: item.started_at
    });

    remainingCapacity -= 1;
    scheduledIssues.push(item.number);
  }

  if (scheduledIssues.length === 0) {
    console.log('Scheduler did not dispatch any items.');
  } else {
    console.log(`Scheduler dispatched issues: ${scheduledIssues.join(', ')}`);
  }

  await writeJson(QUEUE_PATH, queue);
  await saveLocks(LOCKS_PATH, locks);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
