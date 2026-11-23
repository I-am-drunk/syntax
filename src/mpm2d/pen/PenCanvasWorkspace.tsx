import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultSizeStyle,
  TldrawEditor,
  TldrawHandles,
  TldrawOverlays,
  TldrawScribble,
  DefaultSelectionForeground,
  TldrawShapeIndicators,
  allDefaultFontFaces,
  defaultBindingUtils,
  defaultEditorAssetUrls,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  exportToBlob,
  registerDefaultSideEffects,
  useTldrawUser,
  type Editor,
  type TLCameraOptions,
  type TLComponents,
} from 'tldraw'
import 'tldraw/tldraw.css'
import type { LessonSound } from '../../services/lessonSounds'
import {
  MathPackageWorksheet,
  type PaperStyle,
} from './MathPackageWorksheet'
import {
  PenBrilliantChrome,
  PenStepFooter,
  type PenColorId,
  type PenSizeId,
  type PenToolId,
} from './PenCornerHud'
import {
  PenRadialMenu,
  RADIAL_DEADZONE,
  RADIAL_SECTORS,
  angleToSectorIndex,
  type RadialActionId,
  type RadialMenuState,
} from './PenRadialMenu'
import { stampCoordinateAxes } from './penTemplates'
import {
  MIN_SHEET_HEIGHT,
  SHEET_WIDTH,
  loadWorksheetFields,
  saveWorksheetFields,
  type WorksheetField,
  type WorksheetSpec,
} from './worksheetModel'
import './penStudio.css'

const PEN_SDK_TOOLS = [...defaultTools, ...defaultShapeTools]
const PAPER_STYLE_KEY = 'mpm2d-pen-paper-style-v4'

function loadPaperStyle(): PaperStyle {
  try {
    const raw = localStorage.getItem(PAPER_STYLE_KEY)
    if (raw === 'dots' || raw === 'grid' || raw === 'lined' || raw === 'blank') return raw
  } catch {
    // ignore
  }
  return 'dots'
}

function buildStepCameraOptions(sheetHeight: number): TLCameraOptions {
  return {
    isLocked: false,
    wheelBehavior: 'pan',
    panSpeed: 1,
    zoomSpeed: 1,
    zoomSteps: [1, 1.25, 1.5, 2, 2.75, 3.5],
    constraints: {
      bounds: { x: 0, y: 0, w: SHEET_WIDTH, h: Math.max(MIN_SHEET_HEIGHT, sheetHeight) },
      padding: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0 },
      initialZoom: 'fit-x',
      baseZoom: 'fit-x',
      behavior: { x: 'contain', y: 'inside' },
    },
  }
}

type WorksheetCanvasContextValue = {
  field: WorksheetField
  totalSteps: number
  baseHeight: number
  paperStyle: PaperStyle
  theme: 'light' | 'dark'
  onChangeExtraHeight: (fieldId: string, nextExtra: number) => void
}

const WorksheetCanvasContext = createContext<WorksheetCanvasContextValue | null>(null)

function BrilliantPaperBackground() {
  const ctx = useContext(WorksheetCanvasContext)
  return (
    <div
      className="pen-br-canvas-bg"
      data-theme={ctx?.theme ?? 'light'}
      aria-hidden="true"
    />
  )
}

function BrilliantStepSheetLayer() {
  const ctx = useContext(WorksheetCanvasContext)
  if (!ctx) return null
  return (
    <MathPackageWorksheet
      field={ctx.field}
      totalSteps={ctx.totalSteps}
      baseHeight={ctx.baseHeight}
      paperStyle={ctx.paperStyle}
      theme={ctx.theme}
      onChangeExtraHeight={ctx.onChangeExtraHeight}
    />
  )
}

const PDF_EDITOR_COMPONENTS: TLComponents = {
  Scribble: TldrawScribble,
  ShapeIndicators: TldrawShapeIndicators,
  CollaboratorScribble: TldrawScribble,
  SelectionForeground: DefaultSelectionForeground,
  Handles: TldrawHandles,
  Overlays: TldrawOverlays,
  Background: BrilliantPaperBackground,
  OnTheCanvas: BrilliantStepSheetLayer,
}

const CLOSED_RADIAL: RadialMenuState = {
  open: false,
  originX: 0,
  originY: 0,
  cursorX: 0,
  cursorY: 0,
  activeIdx: null,
  stickX: 0,
  stickY: 0,
  pointerAngleRad: null,
  latched: false,
  openedAt: 0,
}

export function PenCanvasWorkspace({
  pageKey,
  theme,
  flipped,
  fullscreen,
  isCorrect = false,
  penControlsCollapsed = true,
  showStepPlan = false,
  worksheetSpec,
  onToggleShowStepPlan,
  onToggleFlip,
  onToggleFullscreen,
  onSound,
}: {
  pageKey: string
  theme: 'light' | 'dark'
  flipped: boolean
  fullscreen: boolean
  isCorrect?: boolean
  penControlsCollapsed?: boolean
  showStepPlan?: boolean
  worksheetSpec: WorksheetSpec
  onToggleShowStepPlan?: () => void
  onToggleFlip: () => void
  onToggleFullscreen: () => void
  onSound?: (cue: LessonSound) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Lock tldraw colorScheme strictly to our Brilliant light/dark theme
  const noopSetUserPreferences = useCallback(() => {}, [])
  const userPrefs = useMemo(
    () => ({
      id: 'mpm2d-student',
      colorScheme: theme,
      isSnapMode: false,
      isDynamicSizeMode: false,
    }),
    [theme],
  )
  const tlUser = useTldrawUser({
    userPreferences: userPrefs,
    setUserPreferences: noopSetUserPreferences,
  })

  const [paperStyle, setPaperStyle] = useState<PaperStyle>(loadPaperStyle)
  const [fields, setFields] = useState<WorksheetField[]>(() =>
    loadWorksheetFields(pageKey, worksheetSpec),
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [baseSheetHeight, setBaseSheetHeight] = useState(MIN_SHEET_HEIGHT)

  const [activeTool, setActiveTool] = useState<PenToolId>('draw')
  const [activeColor, setActiveColor] = useState<PenColorId>('black')
  const [activeSize, setActiveSize] = useState<PenSizeId>('s')
  const [activeOpacity, setActiveOpacity] = useState<number>(1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const [isStroking, setIsStroking] = useState(false)
  const [canvasPointerEpoch, setCanvasPointerEpoch] = useState(0)
  const loadedPageKeyRef = useRef<string>(pageKey)

  const [radial, setRadial] = useState<RadialMenuState>(CLOSED_RADIAL)
  const radialRef = useRef<RadialMenuState>(CLOSED_RADIAL)
  radialRef.current = radial

  const activeToolRef = useRef<PenToolId>(activeTool)
  activeToolRef.current = activeTool
  const activeColorRef = useRef<PenColorId>(activeColor)
  activeColorRef.current = activeColor
  const activeSizeRef = useRef<PenSizeId>(activeSize)
  activeSizeRef.current = activeSize
  const activeOpacityRef = useRef<number>(activeOpacity)
  activeOpacityRef.current = activeOpacity
  const preSpaceToolRef = useRef<PenToolId | null>(null)
  const preEraserToolRef = useRef<PenToolId | null>(null)

  // Reload steps whenever the student navigates to a different lesson page or toggles step plan
  useEffect(() => {
    loadedPageKeyRef.current = pageKey
    setFields(loadWorksheetFields(pageKey, worksheetSpec))
    setStepIndex(0)
  }, [pageKey, worksheetSpec])

  // Persist step completion & custom height/pages (never overwrite another page before reload!)
  useEffect(() => {
    if (loadedPageKeyRef.current !== pageKey) return
    saveWorksheetFields(pageKey, fields)
  }, [pageKey, fields])

  const safeStepIdx = Math.min(stepIndex, Math.max(0, fields.length - 1))
  const activeField = fields[safeStepIdx] ?? {
    id: 'step-0',
    index: 1,
    title: 'Workspace',
    extraHeight: 0,
    checked: false,
  }

  const sheetHeight = Math.max(
    MIN_SHEET_HEIGHT,
    baseSheetHeight + activeField.extraHeight,
  )
  const sheetHeightRef = useRef(sheetHeight)
  sheetHeightRef.current = sheetHeight
  const activeFieldIdRef = useRef(activeField.id)
  activeFieldIdRef.current = activeField.id

  const stepPersistenceKey = `mpm2d-pen-br-v4:${pageKey}:${activeField.id}`

  const cameraOptions = useMemo(
    () => buildStepCameraOptions(sheetHeight),
    [sheetHeight],
  )

  // Sync light/dark theme to live editor
  useEffect(() => {
    const editor = editorRef.current
    if (editor) {
      editor.user.updateUserPreferences({
        colorScheme: theme,
        isSnapMode: false,
      })
    }
  }, [theme])

  // Sync dynamic page height to camera constraints
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.setCameraOptions(buildStepCameraOptions(sheetHeight))
  }, [sheetHeight])

  // Keep full-page height & width fitted edge-to-edge as the viewport resizes
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    let lastW = vp.clientWidth
    let lastH = vp.clientHeight

    const updateDimensions = (w: number, h: number) => {
      if (w <= 40 || h <= 40) return
      const fitZoom = w / SHEET_WIDTH
      const nextBaseH = Math.max(MIN_SHEET_HEIGHT, Math.ceil(h / fitZoom))
      setBaseSheetHeight(nextBaseH)

      if (Math.abs(w - lastW) >= 2 || Math.abs(h - lastH) >= 2) {
        const prevW = lastW > 40 ? lastW : w
        const prevFitZoom = prevW / SHEET_WIDTH
        lastW = w
        lastH = h
        const editor = editorRef.current
        if (editor) {
          const cam = editor.getCamera()
          const wasAtBaseFit = cam.z <= prevFitZoom * 1.06
          const worldCenterX = -cam.x + prevW / (2 * cam.z)
          editor.updateViewportScreenBounds(vp)
          editor.setCameraOptions(buildStepCameraOptions(Math.max(nextBaseH, sheetHeightRef.current)))
          if (wasAtBaseFit) {
            editor.setCamera({ x: 0, y: Math.min(0, cam.y), z: fitZoom }, { immediate: true })
          } else {
            const nextZ = Math.max(fitZoom, cam.z)
            const minX = Math.min(0, w / nextZ - SHEET_WIDTH)
            const nextX = Math.max(minX, Math.min(0, -(worldCenterX - w / (2 * nextZ))))
            editor.setCamera({ x: nextX, y: Math.min(0, cam.y), z: nextZ }, { immediate: true })
          }
        }
      }
    }

    updateDimensions(vp.clientWidth, vp.clientHeight)
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      updateDimensions(rect.width, rect.height)
    })
    ro.observe(vp)
    return () => ro.disconnect()
  }, [])

  const applyTool = useCallback((tool: PenToolId) => {
    setActiveTool(tool)
    const editor = editorRef.current
    if (!editor) return
    editor.setCurrentTool(tool)
    editor.focus()
  }, [])

  const applyColor = useCallback((color: PenColorId) => {
    setActiveColor(color)
    const editor = editorRef.current
    if (!editor) return
    editor.setStyleForNextShapes(DefaultColorStyle, color)
    if (editor.getSelectedShapeIds().length > 0) {
      editor.setStyleForSelectedShapes(DefaultColorStyle, color)
    }
    if (
      activeToolRef.current === 'eraser' ||
      activeToolRef.current === 'hand' ||
      activeToolRef.current === 'select'
    ) {
      setActiveTool('draw')
      editor.setCurrentTool('draw')
    }
  }, [])

  const applySize = useCallback((size: PenSizeId) => {
    setActiveSize(size)
    const editor = editorRef.current
    if (!editor) return
    editor.setStyleForNextShapes(DefaultSizeStyle, size)
    if (editor.getSelectedShapeIds().length > 0) {
      editor.setStyleForSelectedShapes(DefaultSizeStyle, size)
    }
  }, [])

  const applyOpacity = useCallback((opacity: number) => {
    const clamped = Math.max(0.25, Math.min(1, opacity))
    setActiveOpacity(clamped)
    const editor = editorRef.current
    if (!editor) return
    editor.setOpacityForNextShapes(clamped)
    if (editor.getSelectedShapeIds().length > 0) {
      editor.setOpacityForSelectedShapes(clamped)
    }
  }, [])

  const handleSetPaperStyle = useCallback((style: PaperStyle) => {
    setPaperStyle(style)
    try {
      localStorage.setItem(PAPER_STYLE_KEY, style)
    } catch {
      // ignore
    }
  }, [])

  const handleResetZoom = useCallback(() => {
    const editor = editorRef.current
    const vp = viewportRef.current
    if (!editor || !vp) return
    const fitZoom = Math.max(0.25, vp.clientWidth / SHEET_WIDTH)
    editor.setCamera({ x: 0, y: 0, z: fitZoom }, { animation: { duration: 180 } })
  }, [])

  const handleUndo = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editor.getCanUndo()) return
    editor.undo()
    setCanUndo(editor.getCanUndo())
    setCanRedo(editor.getCanRedo())
  }, [])

  const handleRedo = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editor.getCanRedo()) return
    editor.redo()
    setCanUndo(editor.getCanUndo())
    setCanRedo(editor.getCanRedo())
  }, [])

  const handleClearInk = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const ids = Array.from(editor.getCurrentPageShapeIds())
    if (ids.length === 0) return
    editor.markHistoryStoppingPoint('clear-step')
    editor.deleteShapes(ids)
    editor.setCurrentTool('draw')
    setActiveTool('draw')
    const clearedId = activeFieldIdRef.current
    setFields(prev =>
      prev.some(f => f.id === clearedId && f.hasInk)
        ? prev.map(f => (f.id === clearedId ? { ...f, hasInk: false } : f))
        : prev,
    )
    onSound?.('toggle-on')
  }, [onSound])

  const handleStampGrid = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    stampCoordinateAxes(editor)
    setActiveTool('draw')
    onSound?.('toggle-on')
  }, [onSound])

  const handleExportPng = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return
    const ids = Array.from(editor.getCurrentPageShapeIds())
    if (ids.length === 0) return
    try {
      const blob = await exportToBlob({
        editor,
        ids,
        format: 'png',
        opts: { background: true, scale: 2, padding: 32 },
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mpm2d-${pageKey.replace(/[^a-z0-9-_]/gi, '-')}-page-${safeStepIdx + 1}.png`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch {
      // ignore export failure
    }
  }, [pageKey, safeStepIdx])

  const handleChangeExtraHeight = useCallback((fieldId: string, nextExtra: number) => {
    setFields(prev =>
      prev.map(f => (f.id === fieldId ? { ...f, extraHeight: nextExtra } : f)),
    )
  }, [])

  const handleToggleCurrentChecked = useCallback(() => {
    const targetId = activeField.id
    setFields(prev =>
      prev.map(f => (f.id === targetId ? { ...f, checked: !f.checked } : f)),
    )
    onSound?.('toggle-on')
  }, [activeField.id, onSound])

  const handleDeleteStep = useCallback(
    (idxToDelete: number) => {
      const target = fields[idxToDelete]
      if (!target || !target.isCustom) return
      const next = fields
        .filter((_, i) => i !== idxToDelete)
        .map((f, i) => ({ ...f, index: i + 1 }))
      setFields(next)
      setStepIndex(curr =>
        Math.min(Math.max(0, next.length - 1), Math.max(0, curr >= idxToDelete ? curr - 1 : curr)),
      )
      try {
        indexedDB.deleteDatabase(`TLDRAW_DOCUMENT_v2mpm2d-pen-br-v4:${pageKey}:${target.id}`)
      } catch {
        // ignore IDB cleanup failures
      }
      onSound?.('toggle-on')
    },
    [fields, pageKey, onSound],
  )

  const handleAddStep = useCallback(() => {
    const usedNums = fields
      .map(f => {
        const m = f.title.match(/(\d+)$/)
        return m ? Number(m[1]) : 0
      })
      .filter(n => Number.isFinite(n))
    const nextNum = (usedNums.length ? Math.max(...usedNums) : fields.length) + 1
    const nextField: WorksheetField = {
      id: `extra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      index: fields.length + 1,
      title: showStepPlan ? `Extra Page ${nextNum}` : `Page ${nextNum}`,
      subtitle: 'Blank workspace for your own steps or sketches',
      extraHeight: 0,
      checked: false,
      isCustom: true,
    }
    const next = [...fields, nextField]
    setFields(next)
    setStepIndex(next.length - 1)
    onSound?.('toggle-on')
  }, [fields, showStepPlan, onSound])

  const commitRadialAction = useCallback(
    (actionId: RadialActionId) => {
      setRadial(CLOSED_RADIAL)
      if (actionId === 'undo') {
        handleUndo()
        onSound?.('toggle-on')
        return
      }
      applyTool(actionId)
      onSound?.('toggle-on')
    },
    [applyTool, handleUndo, onSound],
  )

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor

      const unsubSideEffects = registerDefaultSideEffects(editor)
      editor.fonts.requestFonts(allDefaultFontFaces)

      editor.user.updateUserPreferences({
        colorScheme: themeRef.current,
        isSnapMode: false,
      })

      editor.setCurrentTool(activeToolRef.current)
      editor.setStyleForNextShapes(DefaultColorStyle, activeColorRef.current)
      editor.setStyleForNextShapes(DefaultSizeStyle, activeSizeRef.current)
      editor.setStyleForNextShapes(DefaultDashStyle, 'draw')
      editor.setOpacityForNextShapes(activeOpacityRef.current)

      // Optimize tldraw input settings for fluid, responsive pen and handwriting
      editor.updateInstanceState({
        isGridMode: false,
      })
      editor.setCameraOptions(buildStepCameraOptions(sheetHeightRef.current))
      const fitToWidthTop = () => {
        const vp = viewportRef.current
        if (!vp || vp.clientWidth <= 40) return
        editor.updateViewportScreenBounds(vp)
        const fitZoom = vp.clientWidth / SHEET_WIDTH
        const nextBaseH = Math.max(MIN_SHEET_HEIGHT, Math.ceil(vp.clientHeight / fitZoom))
        editor.setCameraOptions(buildStepCameraOptions(Math.max(nextBaseH, sheetHeightRef.current)))
        editor.setCamera({ x: 0, y: 0, z: fitZoom }, { immediate: true })
      }
      fitToWidthTop()
      const rafFit = requestAnimationFrame(fitToWidthTop)
      const tFit = window.setTimeout(fitToWidthTop, 110)

      editor.focus()

      setCanUndo(false)
      setCanRedo(false)
      setHasInk(false)
      setIsStroking(false)

      const mountedFieldId = activeFieldIdRef.current
      let prevTool = editor.getCurrentToolId()
      let previousUndo = false
      let previousRedo = false
      let previousHasInk = false
      const syncFieldInk = (hasInkNow: boolean, allowClear: boolean) => {
        if (!hasInkNow && !allowClear) return
        setFields(prev => {
          const cur = prev.find(f => f.id === mountedFieldId)
          if (!cur || Boolean(cur.hasInk) === hasInkNow) return prev
          return prev.map(f => (f.id === mountedFieldId ? { ...f, hasInk: hasInkNow } : f))
        })
      }
      const syncFromEditor = (allowClearInk = false) => {
        const canUndoNow = editor.getCanUndo()
        const canRedoNow = editor.getCanRedo()
        const hasInkNow = editor.getCurrentPageShapeIds().size > 0
        if (canUndoNow !== previousUndo) {
          previousUndo = canUndoNow
          setCanUndo(canUndoNow)
        }
        if (canRedoNow !== previousRedo) {
          previousRedo = canRedoNow
          setCanRedo(canRedoNow)
        }
        if (hasInkNow !== previousHasInk) {
          previousHasInk = hasInkNow
          setHasInk(hasInkNow)
          syncFieldInk(hasInkNow, allowClearInk)
        } else if (hasInkNow) {
          syncFieldInk(true, false)
        }
        const t = editor.getCurrentToolId()
        if (t !== prevTool) {
          prevTool = t
          if (
            t === 'draw' ||
            t === 'highlight' ||
            t === 'line' ||
            t === 'eraser' ||
            t === 'select' ||
            t === 'hand'
          ) {
            setActiveTool(t)
          }
        }
      }

      const unsubStore = editor.store.listen(
        entry => syncFromEditor(entry.source === 'user'),
        { scope: 'all' },
      )
      const onEditorEvent = (ev: { name: string; button?: number }) => {
        if (ev.name === 'pointer_down' && ev.button === 0) {
          setIsStroking(true)
          setCanvasPointerEpoch(n => n + 1)
        } else if (ev.name === 'pointer_up' || ev.name === 'cancel') {
          setIsStroking(false)
          syncFromEditor(true)
        }
      }
      editor.on('event', onEditorEvent)

      syncFromEditor(false)

      return () => {
        cancelAnimationFrame(rafFit)
        window.clearTimeout(tFit)
        setIsStroking(false)
        setCanUndo(false)
        setCanRedo(false)
        unsubSideEffects?.()
        unsubStore?.()
        editor.off('event', onEditorEvent)
        if (editorRef.current === editor) editorRef.current = null
      }
    },
    [stepPersistenceKey],
  )

  // Right-click / stylus barrel radial joystick menu + smart mouse/stylus handoff
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const onPointerDownCapture = (e: PointerEvent) => {
      if (editorRef.current) {
        const inst = editorRef.current.getInstanceState()
        if (!inst.isFocused) editorRef.current.focus()
        if (e.pointerType === 'mouse' && inst.isPenMode) {
          editorRef.current.updateInstanceState({ isPenMode: false })
        }
      }

      if (e.pointerType === 'pen' && (e.button === 5 || e.buttons === 32)) {
        if (activeToolRef.current !== 'eraser') {
          preEraserToolRef.current = activeToolRef.current
          applyTool('eraser')
        }
        return
      }

      if (radialRef.current.open && radialRef.current.latched && e.button === 0) {
        const target = e.target as HTMLElement | null
        if (!target?.closest('.pen-radial-node')) {
          e.preventDefault()
          e.stopPropagation()
          setRadial(CLOSED_RADIAL)
        }
        return
      }

      if (e.button === 2) {
        e.preventDefault()
        e.stopPropagation()

        const rect = vp.getBoundingClientRect()
        const margin = 108
        const midX = (rect.left + rect.right) / 2
        const midY = (rect.top + rect.bottom) / 2
        const minX = Math.min(rect.left + margin, midX)
        const maxX = Math.max(rect.right - margin, midX)
        const minY = Math.min(rect.top + margin, midY)
        const maxY = Math.max(rect.bottom - margin, midY)
        const clampedX = Math.max(minX, Math.min(maxX, e.clientX))
        const clampedY = Math.max(minY, Math.min(maxY, e.clientY))
        const vw = window.innerWidth
        const vh = window.innerHeight
        const originX = Math.max(Math.min(margin, vw / 2), Math.min(Math.max(vw - margin, vw / 2), clampedX))
        const originY = Math.max(Math.min(margin, vh / 2), Math.min(Math.max(vh - margin, vh / 2), clampedY))

        setRadial({
          open: true,
          originX,
          originY,
          cursorX: e.clientX,
          cursorY: e.clientY,
          activeIdx: null,
          stickX: 0,
          stickY: 0,
          pointerAngleRad: null,
          latched: false,
          openedAt: performance.now(),
        })
      }
    }

    const onWindowPointerMove = (e: PointerEvent) => {
      const cur = radialRef.current
      if (!cur.open) return

      const dx = e.clientX - cur.originX
      const dy = e.clientY - cur.originY
      const dist = Math.hypot(dx, dy)

      let activeIdx: number | null = null
      let pointerAngleRad: number | null = null
      let stickX = 0
      let stickY = 0

      if (dist >= RADIAL_DEADZONE) {
        pointerAngleRad = Math.atan2(dy, dx)
        activeIdx = angleToSectorIndex(pointerAngleRad)
        const clamped = Math.min(20, dist * 0.35)
        stickX = Math.cos(pointerAngleRad) * clamped
        stickY = Math.sin(pointerAngleRad) * clamped
      } else if (
        e.pointerType === 'pen' &&
        (Math.abs(e.tiltX) >= 12 || Math.abs(e.tiltY) >= 12)
      ) {
        pointerAngleRad = Math.atan2(e.tiltY, e.tiltX)
        activeIdx = angleToSectorIndex(pointerAngleRad)
        stickX = Math.cos(pointerAngleRad) * 14
        stickY = Math.sin(pointerAngleRad) * 14
      }

      setRadial(prev =>
        prev.open
          ? {
              ...prev,
              cursorX: e.clientX,
              cursorY: e.clientY,
              activeIdx,
              stickX,
              stickY,
              pointerAngleRad,
            }
          : prev,
      )
    }

    const onWindowPointerUp = (e: PointerEvent) => {
      if (preEraserToolRef.current && e.pointerType === 'pen') {
        const restore = preEraserToolRef.current
        preEraserToolRef.current = null
        applyTool(restore)
      }

      const cur = radialRef.current
      if (!cur.open || e.button !== 2) return

      const heldMs = performance.now() - cur.openedAt
      if (cur.activeIdx !== null) {
        commitRadialAction(RADIAL_SECTORS[cur.activeIdx].id)
      } else if (heldMs < 240) {
        setRadial(prev => (prev.open ? { ...prev, latched: true } : prev))
      } else {
        setRadial(CLOSED_RADIAL)
      }
    }

    const onAbortTransient = () => {
      if (preEraserToolRef.current) {
        const restore = preEraserToolRef.current
        preEraserToolRef.current = null
        applyTool(restore)
      }
      if (radialRef.current.open) {
        setRadial(CLOSED_RADIAL)
      }
    }

    vp.addEventListener('contextmenu', onContextMenu, true)
    vp.addEventListener('pointerdown', onPointerDownCapture, true)
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onAbortTransient)
    window.addEventListener('blur', onAbortTransient)
    return () => {
      vp.removeEventListener('contextmenu', onContextMenu, true)
      vp.removeEventListener('pointerdown', onPointerDownCapture, true)
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onAbortTransient)
      window.removeEventListener('blur', onAbortTransient)
    }
  }, [applyTool, commitRadialAction])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          Boolean(
            target.closest(
              'button, a, [role="button"], [role="radio"], [role="radiogroup"], [role="checkbox"], [role="switch"], [role="slider"], [role="dialog"], [role="menu"], .winbox',
            ),
          ))
      ) {
        return
      }
      if (document.querySelector('[role="dialog"], .winbox')) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.code === 'Space' && !e.repeat && preSpaceToolRef.current === null) {
        e.preventDefault()
        preSpaceToolRef.current = activeToolRef.current
        applyTool('hand')
        return
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          applyTool('draw')
          break
        case 'h':
          applyTool('highlight')
          break
        case 'l':
          applyTool('line')
          break
        case 'e':
          applyTool('eraser')
          break
        case 'v':
          applyTool('select')
          break
        case '0':
          handleResetZoom()
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && preSpaceToolRef.current !== null) {
        const prev = preSpaceToolRef.current
        preSpaceToolRef.current = null
        applyTool(prev)
      }
    }

    const onWindowBlur = () => {
      if (preSpaceToolRef.current !== null) {
        const prev = preSpaceToolRef.current
        preSpaceToolRef.current = null
        applyTool(prev)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [applyTool, handleRedo, handleResetZoom, handleUndo])

  const worksheetCtx = useMemo<WorksheetCanvasContextValue>(
    () => ({
      field: activeField,
      totalSteps: fields.length,
      baseHeight: baseSheetHeight,
      paperStyle,
      theme,
      onChangeExtraHeight: handleChangeExtraHeight,
    }),
    [
      activeField,
      fields.length,
      baseSheetHeight,
      paperStyle,
      theme,
      handleChangeExtraHeight,
    ],
  )

  const showGreenPerimeter = Boolean(activeField.checked || isCorrect)

  return (
    <div
      className="pen-studio-root"
      data-theme={theme}
      data-flipped={flipped || undefined}
      data-completed={showGreenPerimeter || undefined}
      data-radial-open={radial.open || undefined}
      data-stroking={isStroking || undefined}
    >
      {/* Outer perimeter Brilliant Green completion edge (stays crisp at ANY canvas zoom!) */}
      {showGreenPerimeter && (
        <div className="pen-outer-complete-frame" aria-hidden="true" />
      )}

      {/* Top Brilliant Bar + Top-Left Collapsible Pull-In / Pull-Out Brush Drawer */}
      <PenBrilliantChrome
        theme={theme}
        defaultDrawerCollapsed={penControlsCollapsed}
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        activeOpacity={activeOpacity}
        paperStyle={paperStyle}
        canUndo={canUndo}
        canRedo={canRedo}
        fullscreen={fullscreen}
        flipped={flipped}
        planSteps={worksheetSpec.planSteps}
        showStepPlan={showStepPlan}
        hasInk={hasInk}
        dimmed={radial.open || isStroking}
        canvasPointerEpoch={canvasPointerEpoch}
        onToggleShowStepPlan={onToggleShowStepPlan}
        onSelectTool={applyTool}
        onSelectColor={applyColor}
        onSelectSize={applySize}
        onSetOpacity={applyOpacity}
        onSetPaperStyle={handleSetPaperStyle}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onStampGrid={handleStampGrid}
        onClearInk={handleClearInk}
        onResetZoom={handleResetZoom}
        onToggleFlip={onToggleFlip}
        onToggleFullscreen={onToggleFullscreen}
        onExportPng={handleExportPng}
      />

      {/* Full-Page Brilliant Digital Paper Engine (1 page per equation step, zero scroll stacks) */}
      <div
        ref={viewportRef}
        className="pen-pdf-viewport"
        data-theme={theme}
      >
        <WorksheetCanvasContext.Provider value={worksheetCtx}>
          <TldrawEditor
            key={stepPersistenceKey}
            persistenceKey={stepPersistenceKey}
            user={tlUser}
            inferDarkMode={false}
            autoFocus
            initialState="draw"
            tools={PEN_SDK_TOOLS}
            shapeUtils={defaultShapeUtils}
            bindingUtils={defaultBindingUtils}
            assetUrls={defaultEditorAssetUrls}
            cameraOptions={cameraOptions}
            components={PDF_EDITOR_COMPONENTS}
            onMount={handleMount}
          />
        </WorksheetCanvasContext.Provider>
      </div>

      {/* Brilliant-Native Bottom Step Bar (stylized arrows + step pills + tactile Done button) */}
      <PenStepFooter
        theme={theme}
        stepIndex={safeStepIdx}
        totalSteps={fields.length}
        checkedSteps={fields.map(f => f.checked)}
        stepIds={fields.map(f => f.id)}
        showStepPlan={showStepPlan}
        currentChecked={activeField.checked}
        dimmed={radial.open}
        onPrevStep={() => {
          setStepIndex(i => Math.max(0, i - 1))
          onSound?.('toggle-on')
        }}
        onNextStep={() => {
          setStepIndex(i => Math.min(fields.length - 1, i + 1))
          onSound?.('toggle-on')
        }}
        onSelectStep={idx => {
          setStepIndex(idx)
          onSound?.('toggle-on')
        }}
        onAddStep={handleAddStep}
        onDeleteStep={handleDeleteStep}
        isCustomSteps={fields.map(f => Boolean(f.isCustom))}
        onToggleChecked={handleToggleCurrentChecked}
      />

      {/* Right-Click / Stylus Barrel Radial Joystick Wheel */}
      <PenRadialMenu
        state={radial}
        activeToolId={activeTool}
        theme={theme}
        onSelect={commitRadialAction}
        onCancel={() => setRadial(CLOSED_RADIAL)}
      />
    </div>
  )
}

export default PenCanvasWorkspace
