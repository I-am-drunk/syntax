import type { ComponentType } from 'react'
import { SyntaxErrorBoundary } from '../../core/ErrorBoundary'
import type { NativeRegisteredCourseTool } from './api.ts'

export function wrapCourseTool(
  tool: NativeRegisteredCourseTool,
  revision: string | undefined,
  onToolCrash: (ownerId: string, ownerName: string, revision: string | undefined, error: unknown) => void,
): NativeRegisteredCourseTool {
  const Inner = tool.component
  const SafeToolComponent: ComponentType<{ courseId: string; onClose: () => void }> = props => (
    <div data-native-ext-root={tool.ownerId}>
      <SyntaxErrorBoundary
        key={revision ?? tool.ownerId}
        scope={tool.ownerId}
        extensionName={tool.ownerName}
        onExitScope={props.onClose}
        exitLabel="Close tool"
        onError={error => {
          onToolCrash(tool.ownerId, tool.ownerName, revision, error)
          props.onClose()
        }}
      >
        <Inner {...props} />
      </SyntaxErrorBoundary>
    </div>
  )
  return Object.freeze({
    ...tool,
    targetCourses: Object.freeze([...tool.targetCourses]),
    component: SafeToolComponent,
  })
}
