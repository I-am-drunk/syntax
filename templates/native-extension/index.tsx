import type { NativeExtension } from './syntax-api'

export const activate: NativeExtension['activate'] = context => {
  context.registerScreen({
    id: 'home',
    title: 'Native fixture',
    component: () => <p>Extension built outside Syntax</p>,
  })
  context.registerCommand({
    id: 'save-sample',
    title: 'Save sample',
    run: () => context.saveData({ tested: true }),
  })
}
