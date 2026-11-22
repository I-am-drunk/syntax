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
  worksheetSpec,
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
  worksheetSpec: WorksheetSpec
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
  const [isStroking, setIsStroking] = useState(false)
  const [canvasPointerEpoch, setCanvasPointerEpoch] = useState(0)

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

  // Reload steps whenever the student navigates to a different lesson page
  useEffect(() => {
    setFields(loadWorksheetFields(pageKey, worksheetSpec))
    setStepIndex(0)
  }, [pageKey, worksheetSpec])

  // Persist step completion & custom height/pages
  useEffect(() => {
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

    const updateDimensions = (w: number, h: number) => {
      if (w <= 40 || h <= 40) return
      const fitZoom = w / SHEET_WIDTH
      const nextBaseH = Math.max(MIN_SHEET_HEIGHT, Math.ceil(h / fitZoom))
      setBaseSheetHeight(nextBaseH)

      if (Math.abs(w - lastW) >= 2) {
        const prevFitZoom = lastW > 40 ? lastW / SHEET_WIDTH : fitZoom
        lastW = w
        const editor = editorRef.current
        if (editor) {
          editor.updateViewportScreenBounds(vp)
          const cam = editor.getCamera()
          const wasAtBaseFit = cam.z <= prevFitZoom * 1.08
          editor.setCameraOptions(buildStepCameraOptions(Math.max(nextBaseH, sheetHeightRef.current)))
          if (wasAtBaseFit) {
            editor.setCamera({ x: 0, y: Math.min(0, cam.y), z: fitZoom }, { immediate: true })
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
    const fitZoom = Math.max(0.4, vp.clientWidth / SHEET_WIDTH)
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
      a.download = `mpm2d-${pageKey.replace(/[^a-z0-9-_]/gi, '-')}-step-${safeStepIdx + 1}.png`
      a.click()
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

  const handleDeleteStep = useCallback((idxToDelete: number) => {
    setFields(prev => {
      const target = prev[idxToDelete]
      if (!target || !target.isCustom) return prev // only custom scratch pages can be deleted
      const next = prev.filter((_, i) => i !== idxToDelete)
      // Re-index remaining fields
      const reindexed = next.map((f, i) => ({ ...f, index: i + 1 }))
      setStepIndex(curr => Math.min(reindexed.length - 1, Math.max(0, curr >= idxToDelete ? curr - 1 : curr)))
      return reindexed
    })
    onSound?.('toggle-on')
  }, [onSound])

    const handleAddStep = useCallback(() => {
    setFields(prev => {
      const extraNum = prev.filter(f => f.isCustom).length + 1
      const next: WorksheetField[] = [
        ...prev,
        {
          id: `extra-${Date.now().toString(36)}`,
          index: prev.length + 1,
          title: `Extra Scratch Page ${extraNum}`,
          subtitle: 'Additional workspace for algebra or verification',
          extraHeight: 0,
          checked: false,
          isCustom: true,
        },
      ]
      setStepIndex(next.length - 1)
      return next
    })
    onSound?.('toggle-on')
  }, [onSound])

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

      let prevTool = editor.getCurrentToolId()
      const syncFromEditor = () => {
        setCanUndo(editor.getCanUndo())
        setCanRedo(editor.getCanRedo())
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

      const unsubStore = editor.store.listen(syncFromEditor, { scope: 'all' })
      const onEditorEvent = (ev: { name: string; button?: number }) => {
        if (ev.name === 'pointer_down' && ev.button === 0) {
          setIsStroking(true)
          setCanvasPointerEpoch(n => n + 1)
        } else if (ev.name === 'pointer_up' || ev.name === 'cancel') {
          setIsStroking(false)
          syncFromEditor()
        }
      }
      editor.on('event', onEditorEvent)

      syncFromEditor()

      return () => {
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
        const margin = 86
        const originX = Math.max(
          rect.left + margin,
          Math.min(rect.right - margin, e.clientX),
        )
        const originY = Math.max(
          rect.top + margin,
          Math.min(rect.bottom - margin, e.clientY),
        )

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

    vp.addEventListener('contextmenu', onContextMenu, true)
    vp.addEventListener('pointerdown', onPointerDownCapture, true)
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    return () => {
      vp.removeEventListener('contextmenu', onContextMenu, true)
      vp.removeEventListener('pointerdown', onPointerDownCapture, true)
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
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
          target.isContentEditable)
      ) {
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

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
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
        dimmed={radial.open || isStroking}
        canvasPointerEpoch={canvasPointerEpoch}
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
