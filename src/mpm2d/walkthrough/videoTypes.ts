export type WalkthroughLensId = 'visual' | 'algebra'

export type WalkthroughBeatAsset = {
  light?: string
  dark?: string
  sema?: string
}

export type WalkthroughChapterRange = {
  /** Beat id in walkthroughData.ts that carries the chapter's title and caption */
  beatId: string
  /** Start time in the packaged lens video (seconds) */
  start: number
  /** End time in the packaged lens video (seconds) */
  end: number
}

export type WalkthroughLensAsset = {
  duration: number
  chapters: WalkthroughChapterRange[]
  /** Standalone per-step video & Sema track files so each step plays its own timeline */
  beats?: Record<string, WalkthroughBeatAsset>
  light?: string
  dark?: string
  sema?: string
  captions?: string
}

export type WalkthroughVideoManifest = Record<string, Partial<Record<WalkthroughLensId, WalkthroughLensAsset>>>
