import type { WalkthroughVideoManifest } from './videoTypes'

export const WALKTHROUGH_VIDEO_MANIFEST: WalkthroughVideoManifest = {
  'l1-p3-worked': {
    algebra: {
      duration: 48.12,
      chapters: [
        { beatId: 'alg-1', start: 0.0, end: 17.68 },
        { beatId: 'alg-2', start: 17.68, end: 31.7 },
        { beatId: 'alg-3', start: 31.7, end: 48.12 },
      ],
      beats: {
        'alg-1': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/alg-1.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/alg-1.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/alg-1.track.json',
        },
        'alg-2': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/alg-2.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/alg-2.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/alg-2.track.json',
        },
        'alg-3': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/alg-3.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/alg-3.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/alg-3.track.json',
        },
      },
      light: '/assets/walkthroughs/l1-p3-worked/light/algebra.mp4',
      dark: '/assets/walkthroughs/l1-p3-worked/dark/algebra.mp4',
      sema: '/assets/walkthroughs/l1-p3-worked/algebra.sema.json',
      captions: '/assets/walkthroughs/l1-p3-worked/algebra.captions.vtt',
    },
    visual: {
      duration: 43.98,
      chapters: [
        { beatId: 'vis-1', start: 0.0, end: 13.95 },
        { beatId: 'vis-2', start: 13.95, end: 29.05 },
        { beatId: 'vis-3', start: 29.05, end: 43.98 },
      ],
      beats: {
        'vis-1': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/vis-1.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/vis-1.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/vis-1.track.json',
        },
        'vis-2': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/vis-2.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/vis-2.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/vis-2.track.json',
        },
        'vis-3': {
          light: '/assets/walkthroughs/l1-p3-worked/beats/light/vis-3.mp4',
          dark: '/assets/walkthroughs/l1-p3-worked/beats/dark/vis-3.mp4',
          sema: '/assets/walkthroughs/l1-p3-worked/beats/vis-3.track.json',
        },
      },
      light: '/assets/walkthroughs/l1-p3-worked/light/visual.mp4',
      dark: '/assets/walkthroughs/l1-p3-worked/dark/visual.mp4',
      sema: '/assets/walkthroughs/l1-p3-worked/visual.sema.json',
      captions: '/assets/walkthroughs/l1-p3-worked/visual.captions.vtt',
    },
  },
}
