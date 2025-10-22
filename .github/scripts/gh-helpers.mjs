import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function ensureDirForFile(path) {
  await mkdir(dirname(path), { recursive: true });
}

async function writeJson(path, data) {
  await ensureDirForFile(path);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback ?? null;
    }
    throw error;
  }
}

async function githubRequest(method, route, body) {
  const token = requireEnv('GH_TOKEN');
  const repo = requireEnv('GITHUB_REPOSITORY');
  const baseUrl = process.env['GITHUB_API_URL'] ?? 'https://api.github.com';
  const url = `${baseUrl}/repos/${repo}${route}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}\n${text}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function addLabels(issueNumber, labels) {
  if (!labels || labels.length === 0) return;
  await githubRequest('POST', `/issues/${issueNumber}/labels`, { labels });
}

async function createIssueComment(issueNumber, body) {
  await githubRequest('POST', `/issues/${issueNumber}/comments`, { body });
}

async function updateIssue(issueNumber, payload) {
  await githubRequest('PATCH', `/issues/${issueNumber}`, payload);
}

async function dispatchWorkflow(workflowFile, ref, inputs) {
  await githubRequest('POST', `/actions/workflows/${workflowFile}/dispatches`, {
    ref,
    inputs
  });
}

export {
  addLabels,
  createIssueComment,
  dispatchWorkflow,
  githubRequest,
  readJson,
  requireEnv,
  updateIssue,
  writeJson
};
