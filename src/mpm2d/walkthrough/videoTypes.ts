export type WalkthroughLensId = 'visual' | 'algebra'

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
  light?: string
  dark?: string
  sema?: string
  captions?: string
}

export type WalkthroughVideoManifest = Record<string, Partial<Record<WalkthroughLensId, WalkthroughLensAsset>>>
