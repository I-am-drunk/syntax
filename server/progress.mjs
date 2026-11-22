import { mkdir, readFile, writeFile, rename, unlink, realpath, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCourseSlug, parseProgress, parseProgressId, parseProgressReceipt } from '../shared/progress.js';

let writes = Promise.resolve();
const identities = progress => progress.contents.map(({ kind, courseSlug, slug, version }) =>
  [kind, courseSlug, slug, version]);

async function directory(create) {
  let result = resolve(process.env.SYNTAX_PROGRESS_DIR ?? join(homedir(), '.local/share/syntax/progress'));
  const app = await realpath(fileURLToPath(new URL('../', import.meta.url)));
  const check = () => {
    if (result === app || result.startsWith(app + sep)) throw new Error('Progress storage must be outside the app');
  };
  check();
  if (create) await mkdir(result, { recursive: true, mode: 0o700 });
  result = await realpath(result); check();
  return result;
}

async function load(folder, id) {
  const record = parseProgressReceipt(JSON.parse(await readFile(join(folder, id + '.json'), 'utf8')));
  if (record.progress.id !== id) throw new Error('Progress identity mismatch');
  return record;
}

export async function readProgress(id) {
  return load(await directory(false), parseProgressId(id));
}

export async function readSavedActivity() {
  let folder;
  try { folder = await directory(false); }
  catch (error) {
    if (error.code === 'ENOENT') return { records: [] };
    throw error;
  }
  const records = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    let id;
    try { id = parseProgressId(entry.name.slice(0, -5)); } catch { continue; }
    records.push(await load(folder, id));
  }
  records.sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.progress.id.localeCompare(b.progress.id));
  return { records };
}

export async function readCourseProgress(value) {
  const courseSlug = parseCourseSlug(value), completed = new Map();
  let folder;
  try { folder = await directory(false); }
  catch (error) {
    if (error.code === 'ENOENT') return { courseSlug, completedLessons: [] };
    throw error;
  }
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    let id;
    try { id = parseProgressId(entry.name.slice(0, -5)); } catch { continue; }
    const { progress } = await load(folder, id);
    for (const item of progress.contents) {
      if (item.kind === 'lesson' && item.courseSlug === courseSlug && item.completed)
        completed.set(item.slug + '/' + item.version, { slug: item.slug, version: item.version });
    }
  }
  return { courseSlug, completedLessons: [...completed.entries()]
    .sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item) };
}

function conflict() {
  const error = new Error('This progress snapshot conflicts with an accepted save');
  error.code = 'PROGRESS_CONFLICT';
  throw error;
}

async function save(input) {
  const folder = await directory(true), destination = join(folder, input.id + '.json');
  let previous;
  try { previous = await load(folder, input.id); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    const saved = previous.progress;
    if (input.revision < saved.revision
      || JSON.stringify(identities(saved)) !== JSON.stringify(identities(input))) conflict();
    if (input.revision === saved.revision) {
      if (JSON.stringify(saved) !== JSON.stringify(input)) conflict();
      return previous;
    }
    if (saved.contents.some((item, index) => item.completed && !input.contents[index].completed)) conflict();
  }
  const record = { accepted: true, progress: input, savedAt: new Date().toISOString() };
  const temporary = join(folder, '.pending-' + randomUUID());
  try {
    await writeFile(temporary, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  return record;
}

export function saveProgress(value) {
  const input = parseProgress(value);
  const operation = writes.then(() => save(input));
  writes = operation.then(() => {}, () => {});
  return operation;
}
