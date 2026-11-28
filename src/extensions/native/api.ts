import type { ComponentType } from 'react'

export type NativeData = null | boolean | number | string | NativeData[] | { [key: string]: NativeData }

export type NativeSoundCue = 'correct' | 'incorrect' | 'click' | 'complete'

export interface NativeCourseProgress {
  completed: number
  total: number
  label?: string
}

export interface NativeScreen {
  id: string
  title: string
  kind?: 'course' | 'tool'
  subtitle?: string
  component: ComponentType
}

export interface NativeCommand {
  id: string
  title: string
  run: () => void | Promise<void>
}

export interface NativeExtensionContext {
  readonly signal: AbortSignal
  registerScreen(screen: NativeScreen): void
  registerCommand(command: NativeCommand): void
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
