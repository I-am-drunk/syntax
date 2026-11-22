import { parseCourseSlug, parseProgress, parseProgressId } from '../shared/progress.js';
import { readCourseProgress, readProgress, readSavedActivity, saveProgress } from './progress.mjs';

export async function handleProgressRequest(request, send) {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'GET') {
    if (url.searchParams.has('activity')) {
      if (url.searchParams.size !== 1 || url.searchParams.get('activity') !== '1')
        return send(400, { error: 'Invalid activity query.' });
      try { return send(200, await readSavedActivity()); }
      catch { return send(503, { error: 'Saved activity is unavailable.' }); }
    }
    if (url.searchParams.has('course')) {
      let course;
      try {
        if (url.searchParams.size !== 1) throw new Error('Expected one course');
        course = parseCourseSlug(url.searchParams.get('course'));
      } catch { return send(400, { error: 'Invalid course identifier.' }); }
      try { return send(200, await readCourseProgress(course)); }
      catch { return send(503, { error: 'Saved course progress is unavailable.' }); }
    }
    let id;
    try {
      if (url.searchParams.size !== 1) throw new Error('Expected one identifier');
      id = parseProgressId(url.searchParams.get('id'));
    } catch { return send(400, { error: 'Invalid progress identifier.' }); }
    try { return send(200, await readProgress(id)); }
    catch (error) {
      return send(error.code === 'ENOENT' ? 404 : 503, { error: 'Saved progress is unavailable.' });
    }
  }
  if (request.method !== 'PUT') return send(405, { error: 'Method not allowed' });
  if (url.search) return send(400, { error: 'Unexpected progress query.' });
  let input;
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) return send(413, { error: 'Progress snapshot is too large.' });
      chunks.push(chunk);
    }
    input = parseProgress(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch { return send(400, { error: 'Invalid progress snapshot.' }); }
  try { return send(200, await saveProgress(input)); }
  catch (error) {
    return send(error.code === 'PROGRESS_CONFLICT' ? 409 : 503, { error: 'Progress could not be saved.' });
  }
}
