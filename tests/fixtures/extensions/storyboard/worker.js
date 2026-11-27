let activatedPrefix = null

export async function onActivate(ctx) {
  activatedPrefix = await ctx.settings.get('defaultPrefix')
  ctx.log.info(`Storyboard Studio activated (prefix=${activatedPrefix})`)
}

export async function getActivatedPrefix() {
  return activatedPrefix
}

export async function setPrefix(ctx, nextPrefix) {
  return await ctx.settings.set('defaultPrefix', nextPrefix)
}

export async function listBoards(ctx) {
  const docs = await ctx.documents.list('storyboard')
  if (docs.length === 0) {
    return ['Storyboard', 'Record voiceover']
  }
  return docs.flatMap(d => (Array.isArray(d.data?.tasks) ? d.data.tasks : [d.title]))
}

export async function createSample(ctx, title = 'Launch Video') {
  const doc = await ctx.documents.create({
    type: 'storyboard',
    title,
    schemaVersion: 1,
    data: {
      tasks: ['Storyboard', 'Record voiceover'],
    },
  })
  return doc
}

export async function addTask(ctx, docId, expectedRevision, taskText) {
  const doc = await ctx.documents.get(docId)
  if (!doc) throw new Error('Document not found')
  const tasks = [...(doc.data?.tasks ?? []), taskText]
  return await ctx.documents.save({
    id: docId,
    expectedRevision,
    title: doc.title,
    data: { tasks },
  })
}

export async function exportOwn(ctx) {
  const tasks = await listBoards(ctx)
  await ctx.ui.notify(`Storyboard own export: ${tasks.length} items`, 'info')
  return { source: 'tj.storyboard', tasks }
}
