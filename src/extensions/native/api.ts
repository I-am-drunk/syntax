import type { ComponentType } from 'react'

export type NativeData = null | boolean | number | string | NativeData[] | { [key: string]: NativeData }

export type NativeSoundCue = 'correct' | 'incorrect' | 'click' | 'complete'

export interface NativeCourseProgress {
  completed: number
  total: number
  label?: string
}

export interface NativeRecommendedTool {
  id: string
  name: string
  description: string
  manifestUrl?: string
}

export interface NativeScreen {
  id: string
  title: string
  kind?: 'course' | 'tool'
  subtitle?: string
  recommendedTools?: readonly NativeRecommendedTool[]
  component: ComponentType
}

export interface NativeCommand {
  id: string
  title: string
  run: () => void | Promise<void>
}

export interface NativeEmbeddedExtension {
  id: string
  title: string
  setup(
    context: NativeExtensionContext,
  ): void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>
}

export interface NativeCourseTool {
  id: string
  title: string
  buttonLabel: string
  targetCourses: readonly string[]
  component: ComponentType<{ courseId: string; onClose: () => void }>
}

export interface NativeRegisteredCourseTool extends NativeCourseTool {
  ownerId: string
  ownerName: string
}

export interface NativeStyleRegistration {
  id: string
  css: string
  scope?: 'scoped' | 'global'
}

export interface NativeExtensionContext {
  readonly signal: AbortSignal
  registerScreen(screen: NativeScreen): void
  registerCommand(command: NativeCommand): void
  registerEmbedded(embedded: NativeEmbeddedExtension): Promise<void>
  registerCourseTool(tool: NativeCourseTool): void
  registerStyles(style: NativeStyleRegistration): void
  openScreen(screenId: string): void
  onDispose(callback: () => void | Promise<void>): void
  loadData(): Promise<NativeData | undefined>
  saveData(data: NativeData): Promise<void>
  getProgress(): Promise<NativeCourseProgress | undefined>
  reportProgress(progress: NativeCourseProgress | null): Promise<void>
  playSound(cue: NativeSoundCue): void
}

export interface NativeExtension {
  activate(context: NativeExtensionContext): void | Promise<void>
}
