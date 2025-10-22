import { Minimatch } from 'minimatch';
import { readJson, writeJson } from './gh-helpers.mjs';

const MATCH_OPTIONS = { dot: true, nocase: false };

function globOverlaps(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const matcherA = new Minimatch(a, MATCH_OPTIONS);
  const matcherB = new Minimatch(b, MATCH_OPTIONS);
  return matcherA.match(b) || matcherB.match(a);
}

function locksForFiles(files, locks) {
  const conflicts = [];
  for (const lock of locks) {
    for (const lockedGlob of lock.files ?? []) {
      for (const fileGlob of files ?? []) {
        if (globOverlaps(fileGlob, lockedGlob)) {
          conflicts.push(lock);
          break;
        }
      }
      if (conflicts.at(-1) === lock) {
        break;
      }
    }
  }
  return conflicts;
}

async function loadLocks(path) {
  return (await readJson(path, [])) ?? [];
}

async function saveLocks(path, locks) {
  await writeJson(path, locks);
}

function removeLockForIssue(locks, issueNumber) {
  return locks.filter((lock) => lock.issue !== issueNumber);
}

export {
  globOverlaps,
  loadLocks,
  locksForFiles,
  removeLockForIssue,
  saveLocks
};
