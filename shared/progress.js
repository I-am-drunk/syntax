const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const asset = /^[A-Za-z0-9_]+$/;

function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Invalid progress fields');
}

function text(value, pattern, limit) {
  if (typeof value !== 'string' || value.length > limit || !pattern.test(value))
    throw new Error('Invalid progress identity');
  return value;
}

export function parseProgressId(value) {
  return text(value, uuid, 36);
}

export function parseCourseSlug(value) {
  return text(value, slug, 100);
}

export function parseCourseProgress(value) {
  object(value, ['courseSlug', 'completedLessons']);
  if (!Array.isArray(value.completedLessons)) throw new Error('Invalid course progress');
  const completedLessons = value.completedLessons.map(item => {
    object(item, ['slug', 'version']);
    return { slug: text(item.slug, slug, 100), version: text(item.version, slug, 100) };
  });
  unique(completedLessons.map(item => item.slug + '/' + item.version));
  return { courseSlug: parseCourseSlug(value.courseSlug), completedLessons };
}

function parseProblem(value) {
  object(value, ['asset', 'state']);
  if (value.state !== 'correct' && value.state !== 'incorrect') throw new Error('Invalid outcome');
  return { asset: text(value.asset, asset, 160), state: value.state };
}

function unique(values) {
  if (new Set(values).size !== values.length) throw new Error('Duplicate progress identity');
}

function parseContent(value) {
  object(value, ['kind', 'courseSlug', 'slug', 'version', 'completed', 'problems']);
  if (!['lesson', 'practice'].includes(value.kind) || typeof value.completed !== 'boolean'
    || !Array.isArray(value.problems) || value.problems.length > 128) throw new Error('Invalid progress');
  const problems = value.problems.map(parseProblem);
  unique(problems.map(problem => problem.asset));
  return { kind: value.kind, courseSlug: text(value.courseSlug, slug, 100),
    slug: text(value.slug, slug, 100), version: text(value.version, slug, 100),
    completed: value.completed, problems };
}

export function parseProgress(value) {
  object(value, ['id', 'revision', 'contents']);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1
    || !Array.isArray(value.contents) || value.contents.length < 1 || value.contents.length > 2)
    throw new Error('Invalid progress snapshot');
  const contents = value.contents.map(parseContent);
  if ((contents[0].kind === 'practice' && contents.length !== 1)
    || (contents[1] && (contents[1].kind !== 'practice'
      || contents[1].courseSlug !== contents[0].courseSlug))) throw new Error('Invalid content order');
  return { id: parseProgressId(value.id), revision: value.revision, contents };
}

export function parseProgressReceipt(value) {
  object(value, ['accepted', 'progress', 'savedAt']);
  if (value.accepted !== true || typeof value.savedAt !== 'string'
    || !Number.isFinite(Date.parse(value.savedAt))
    || new Date(value.savedAt).toISOString() !== value.savedAt) throw new Error('Invalid save receipt');
  return { accepted: true, progress: parseProgress(value.progress), savedAt: value.savedAt };
}
