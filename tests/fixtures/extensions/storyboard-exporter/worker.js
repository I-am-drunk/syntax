export async function onActivate(ctx) {
  const hasAnalytics = await ctx.services.has('tj.missing/analytics')
  ctx.log.info(`Storyboard Exporter activated (analytics=${hasAnalytics})`)
}

export async function exportBoard(ctx, filename = 'deck.md') {
  const tasks = await ctx.services.call('tj.storyboard/boards', 'listBoards')
  const hasAnalytics = await ctx.services.has('tj.missing/analytics')
  return {
    source: 'tj.exporter',
    filename,
    hasAnalytics,
    output: `${filename}: ${tasks.join(', ')}`,
  }
}

export async function exportWithError() {
  throw new Error('Missing export filename')
}

export async function hangForever() {
  // Deliberate infinite loop to prove WorkerSandbox isolation and stopWorker recovery
  // eslint-disable-next-line no-constant-condition
  while (true) {}
}
