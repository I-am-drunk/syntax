export async function onActivate(ctx) {
  ctx.log.warn('About to throw inside onActivate')
  throw new Error('Boom during onActivate')
}

export async function run() {
  return 'unreachable'
}
