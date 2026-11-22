---
name: videojs-react
description: Reference for building and customizing media players with Video.js 10 (@videojs/react v10.6+). Use whenever importing from @videojs/react or @videojs/react/video, wiring chapters, captions, TimeSlider, Controls, Gesture, Hotkey, or custom player hooks.
---

# Video.js 10 (`@videojs/react`) Skill

> `@vidstack/react` is deprecated and in security-only maintenance. Video.js 10 (`@videojs/react`) is the unified successor from the Vidstack, Plyr, Media Chrome, and Video.js teams. Always use `@videojs/react` for video playback in Syntax.

## Core Pattern

```tsx
import {
  BufferingIndicator,
  Container,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Gesture,
  Hotkey,
  MuteButton,
  PlayButton,
  PlaybackRateButton,
  StatusAnnouncer,
  Time,
  TimeSlider,
  createPlayer,
  useCreateTextTrack,
  type TextCueInit,
} from '@videojs/react'
import { Video, videoFeatures } from '@videojs/react/video'

const { Player, usePlayer, useMedia } = createPlayer({
  features: videoFeatures,
})
```

## Key Building Blocks

1. **`<Player>` and `usePlayer`:**
   - `<Player>` creates the feature-backed store and renders no DOM element.
   - `const store = usePlayer()` returns the store for imperative actions: `store.play()`, `store.pause()`, `store.seek(seconds)`, `store.setMuted(bool)`, `store.setVolume(0..1)`.
   - `const paused = usePlayer(s => s.paused)` subscribes to reactive state (`s.paused`, `s.ended`, `s.currentTime`, `s.duration`, `s.muted`, `s.seeking`).

2. **`<Container>` and `<Video>`:**
   - `<Container>` is the positioned layout box, fullscreen target, user-activity surface, and gesture surface.
   - `<Video src={...} playsInline preload="auto" ref={videoRef}>` renders the native `<video>` element and attaches it to `<Player>`. Add `<track kind="captions" src={...} srcLang="en" label="English" />` as children.

3. **Programmatic Chapters with `useCreateTextTrack` + `<TimeSlider.Chapters>`:**
   - Register chapter cues from React state/props without needing an external `.vtt` file:
     ```tsx
     useCreateTextTrack({
       kind: 'chapters',
       label: 'Steps',
       language: 'en',
       cues: [
         { id: 'vis-1', startTime: 0, endTime: 13.95, text: '① Isolate y' },
         { id: 'vis-2', startTime: 13.95, endTime: 29.05, text: '② Flip & negate' },
       ],
     })
     ```
   - Keep `cues` memoized (`useMemo`) so the track is not recreated on every render.
   - Render segmented chapter bars inside `<TimeSlider.Root pauseOnDrag>`:
     ```tsx
     <TimeSlider.Root className="wt-vjs-slider" pauseOnDrag>
       <TimeSlider.Chapters
         className="wt-vjs-chapters"
         renderChapter={props => (
           <div {...props} className="wt-vjs-chapter">
             <TimeSlider.Track className="wt-vjs-track">
               <TimeSlider.Buffer className="wt-vjs-buffer" />
               <TimeSlider.Fill className="wt-vjs-fill" />
             </TimeSlider.Track>
           </div>
         )}
       />
       <TimeSlider.Thumb className="wt-vjs-thumb" />
       <TimeSlider.Preview className="wt-vjs-preview" overflow="clamp">
         <TimeSlider.ChapterTitle className="wt-vjs-preview-chapter" />
         <TimeSlider.Value type="pointer" className="wt-vjs-preview-time" />
       </TimeSlider.Preview>
     </TimeSlider.Root>
     ```
   - Each chapter receives `--media-slider-chapter-start` and `--media-slider-chapter-end` CSS custom properties, while `.wt-vjs-fill`, `.wt-vjs-buffer`, and `.wt-vjs-thumb` use `--media-slider-fill`, `--media-slider-buffer`, and `--media-slider-pointer`.

4. **Gestures & Keyboard Shortcuts:**
   - `<Gesture type="tap" action="togglePaused" region="center" />` ignores any element with interactive controls or `stopPropagation` (such as `<SemaStageRuntime>`).
   - `<Hotkey keys="Space" action="togglePaused" />`, `<Hotkey keys="ArrowLeft" action="seekStep" value={-3} />`, etc., scope keyboard shortcuts to the player container.

5. **Full Bundled Documentation:**
   - Complete markdown guides and API references are bundled locally at `node_modules/@videojs/react/docs/llms.txt`.
