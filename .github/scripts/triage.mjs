import { addLabels, createIssueComment, readJson, requireEnv, writeJson } from './gh-helpers.mjs';
import { readFile } from 'node:fs/promises';

const QUEUE_PATH = '.ai/queue.json';

function loadEvent() {
  const path = requireEnv('GITHUB_EVENT_PATH');
  return readFile(path, 'utf8').then((raw) => JSON.parse(raw));
}

function parseFormValue(body, heading) {
  if (!body) return null;
  const pattern = new RegExp(`### ${heading}\\s*\\n([^#]+)`, 'i');
  const match = body.match(pattern);
  if (!match) return null;
  return match[1].trim();
}

function normaliseComponent(component, config) {
  const key = (component ?? '').toLowerCase();
  if (config.components?.[key]) {
    return key;
  }
  return 'unknown';
}

function normaliseComplexity(value) {
  const clean = (value ?? '').toUpperCase();
  if (['S', 'M', 'L'].includes(clean)) {
    return clean;
  }
  return 'M';
}

function extractHints(body) {
  const value = parseFormValue(body, 'Likely files or directories');
  if (!value) return [];
  return value
    .split(/\r?\n|,/) // allow newline or comma separation
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function computePriority(typeLabel, complexity) {
  let priority = 1000;
  if (typeLabel === 'type:bug') {
    priority -= 400;
  }
  if (complexity === 'S') {
    priority -= 150;
  } else if (complexity === 'L') {
    priority += 150;
  }
  return priority;
}

function ensureQueueArray(queue) {
  if (!Array.isArray(queue)) {
    return [];
  }
  return queue;
}

async function main() {
  const event = await loadEvent();
  const issue = event.issue;
  if (!issue) {
    throw new Error('triage.mjs expects an issue payload');
  }

  const config = await readJson('.ai/config.json', {});
  const component = normaliseComponent(parseFormValue(issue.body, 'Component'), config);
  const complexity = normaliseComplexity(parseFormValue(issue.body, 'Complexity'));
  const hints = extractHints(issue.body);

  const typeLabel = issue.labels?.map((label) => label.name).find((name) => name.startsWith('type:')) ?? 'type:unknown';
  const labelsToApply = new Set([
    typeLabel,
    `component:${component}`,
    `complexity:${complexity}`,
    config.labels?.triaged ?? 'triaged'
  ]);

  const files = [...new Set([...(config.components?.[component] ?? []), ...hints])];
  const priority = computePriority(typeLabel, complexity);

  const queue = ensureQueueArray(await readJson(QUEUE_PATH, []));
  const existingIndex = queue.findIndex((entry) => entry.number === issue.number);
  const existing = existingIndex >= 0 ? queue[existingIndex] : null;
  const status = existing?.status ?? 'queued';
  const mergedLabels = Array.from(new Set([...(existing?.labels ?? []), ...labelsToApply]));

  const entry = {
    ...existing,
    number: issue.number,
    title: issue.title,
    component,
    files,
    labels: mergedLabels,
    priority,
    status
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = entry;
  } else {
    queue.push(entry);
  }

  queue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.number - b.number;
  });

  await writeJson(QUEUE_PATH, queue);

  await addLabels(issue.number, Array.from(labelsToApply));

  const summaryLines = [
    '### 🤖 Auto-triage summary',
    `- Component: **${component}**`,
    `- Complexity: **${complexity}**`,
    `- Type: **${typeLabel.replace('type:', '')}**`,
    `- Status: **${status}**`,
    `- Target globs: ${files.length ? files.map((f) => `\`${f}\``).join(', ') : '_none_'}`,
    '',
    `Priority score: ${priority}.`,
    '',
    '> TODO: replace draft work package hand-off with live agent invocation.'
  ];

  await createIssueComment(issue.number, summaryLines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
