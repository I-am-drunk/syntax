import { Canvas, PencilBrush, FabricImage, ActiveSelection, Rect, Ellipse, filters } from 'fabric';
import type { FabricObject } from 'fabric';
export type DrawingMode = 'select' | 'pencil' | 'blur' | 'rect' | 'ellipse';
export const drawingColors = ['#ff0000', '#ffcc00', '#00c274', '#0000FF', '#6552ff', '#808080'];
const colorNames = ['red', 'yellow', 'green', 'blue', 'purple', 'grey'];
const corners = { cornerSize: 10, cornerStyle: 'circle' as const, lockScalingFlip: true };
export async function createReportCanvas(element: HTMLCanvasElement, holder: HTMLElement, url: string,
  initial: { mode: DrawingMode; color: string; json?: object },
  onUpdate: (blob: Blob, json: object) => void, onMode: (mode: DrawingMode) => void,
  onError: (error: unknown) => void, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const canvas = new Canvas(element), brush = new PencilBrush(canvas);
  brush.width = 3; brush.color = initial.color;
  let mode = initial.mode, color = initial.color, disposed = false, drawing = false, enabled = true;
  let start = { x: 0, y: 0 }, shape: FabricObject | undefined, compressedUrl: string | undefined;
  let blurPool: FabricImage[] = [], pendingBlur: Promise<void> | undefined;
  let observer: ResizeObserver | undefined, exportRevision = 0;
  let lastExport: Promise<void> = Promise.resolve();
  let keydown: ((event: KeyboardEvent) => void) | undefined, sourceImage: FabricImage | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true; exportRevision++; observer?.disconnect();
    if (keydown) holder.removeEventListener('keydown', keydown);
    signal?.removeEventListener('abort', dispose);
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    blurPool.forEach(patch => patch.dispose()); blurPool = [];
    if (sourceImage && !canvas.getObjects().includes(sourceImage)) sourceImage.dispose();
    void canvas.dispose();
  };
  signal?.addEventListener('abort', dispose, { once: true });
  try {
  const image = sourceImage = await FabricImage.fromURL(url, { signal });
  if (disposed) { image.dispose(); throw new DOMException('Aborted', 'AbortError'); }
  const compressedSource = async () => {
    if (compressedUrl) return compressedUrl;
    const compressed = document.createElement('canvas'); compressed.width = image.width; compressed.height = image.height;
    compressed.getContext('2d')!.drawImage(image.getElement(), 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => compressed.toBlob(b => b ? resolve(b) : reject(new Error('Image compression failed')), 'image/jpeg', .5));
    if (disposed) throw new DOMException('Aborted', 'AbortError');
    return compressedUrl = URL.createObjectURL(blob);
  };
  let background = image;
  if (initial.json) {
    const json = structuredClone(initial.json) as { objects: { type: string; src?: string }[] };
    for (const [index, object] of json.objects.entries()) {
      if (object.type === FabricImage.type) object.src = index === 0 ? url : await compressedSource();
    }
    await canvas.loadFromJSON(json, undefined, { signal }); background = canvas.getObjects()[0] as FabricImage;
  } else canvas.add(background);
  background.set({ selectable: false, evented: false });
  canvas.setDimensions({ width: background.getScaledWidth(), height: background.getScaledHeight() });
  canvas.getObjects().forEach(object => object.set(corners));
  const fit = () => {
    if (!holder.clientWidth || !holder.clientHeight || disposed) return;
    const scale = Math.min(holder.clientWidth / background.width, holder.clientHeight / background.height);
    const ratio = scale / background.scaleX;
    background.set({ scaleX: scale, scaleY: scale });
    canvas.getObjects().filter(o => o !== background).forEach(o => {
      o.set({ scaleX: o.scaleX * ratio, scaleY: o.scaleY * ratio, left: o.left * ratio, top: o.top * ratio }); o.setCoords();
    });
    canvas.setDimensions({ width: background.getScaledWidth(), height: background.getScaledHeight() }); canvas.renderAll();
  };
  const flush = async () => {
    if (disposed) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const revision = ++exportRevision, json = canvas.toJSON();
    lastExport = canvas.toBlob({ multiplier: 1 / background.scaleX }).then(blob => {
      if (disposed) throw new DOMException('Aborted', 'AbortError');
      if (revision !== exportRevision) return lastExport;
      if (!blob) throw new Error('The edited image could not be exported.');
      onUpdate(blob, json);
    }).catch(error => {
      if (!disposed && revision !== exportRevision) return lastExport;
      throw error;
    });
    return lastExport;
  };
  const prepareBlur = () => pendingBlur ??= (async () => {
    const patch = await FabricImage.fromURL(await compressedSource(), { signal });
    patch.lockRotation = true; patch.filters = [new filters.Blur({ blur: .25 })]; patch.applyFilters();
    if (disposed) patch.dispose(); else blurPool.push(patch);
  })().finally(() => { pendingBlur = undefined; });
  const setMode = (next: DrawingMode) => {
    mode = next; canvas.isDrawingMode = enabled && mode !== 'select';
    canvas.freeDrawingBrush = mode === 'pencil' ? brush : undefined;
    const suffix = mode === 'pencil' ? ` report-canvas-cursor-${colorNames[drawingColors.indexOf(color)]}` : '';
    canvas.lowerCanvasEl.className = canvas.upperCanvasEl.className = `report-canvas${suffix}`;
  };
  canvas.on('path:created', ({ path }) => { path.set(corners); canvas.renderAll(); });
  const restrictSelection = () => {
    const active = canvas.getActiveObject();
    if (!(active instanceof ActiveSelection)) return;
    active.set(corners);
    if (!active.getObjects().some(object => object instanceof FabricImage)) return;
    const selected = active.getObjects().filter(object => !(object instanceof FabricImage));
    canvas.discardActiveObject();
    if (selected.length === 1) canvas.setActiveObject(selected[0]);
    else if (selected.length > 1) canvas.setActiveObject(new ActiveSelection(selected, { canvas, ...corners }));
    canvas.renderAll();
  };
  canvas.on('selection:created', restrictSelection);
  canvas.on('object:moving', ({ target }) => {
    if (!(target instanceof FabricImage)) return;
    target.left = Math.min(Math.max(0, target.left), canvas.width - target.width * target.scaleX);
    target.top = Math.min(Math.max(0, target.top), canvas.height - target.height * target.scaleY);
    target.set({ cropX: target.left / target.scaleX, cropY: target.top / target.scaleY }); canvas.renderAll();
  });
  canvas.on('object:scaling', ({ target, transform }) => {
    const x = ['scale', 'scaleX'].includes(transform.action ?? ''), y = ['scale', 'scaleY'].includes(transform.action ?? '');
    if (target instanceof FabricImage) {
      let width = Math.min(target.width * target.scaleX, canvas.width - target.left);
      let height = Math.min(target.height * target.scaleY, canvas.height - target.top);
      if (target.left < 0) { width += target.left; target.left = 0; }
      if (target.top < 0) { height += target.top; target.top = 0; }
      if (x) target.set({ width: width / background.scaleX, scaleX: background.scaleX, cropX: target.left / background.scaleX });
      if (y) target.set({ height: height / background.scaleY, scaleY: background.scaleY, cropY: target.top / background.scaleY });
    }
    if (target instanceof Rect) {
      if (x) target.set({ width: target.width * target.scaleX, scaleX: 1 });
      if (y) target.set({ height: target.height * target.scaleY, scaleY: 1 });
    }
    if (target instanceof Ellipse) {
      if (x) target.set({ rx: target.rx * target.scaleX, scaleX: 1 });
      if (y) target.set({ ry: target.ry * target.scaleY, scaleY: 1 });
    }
  });
  canvas.on('mouse:down', event => {
    restrictSelection(); if (!canvas.isDrawingMode || disposed || !enabled) return;
    drawing = true; start = canvas.getPointer(event.e);
    const common = { left: start.x, top: start.y, width: 0, height: 0, fill: 'transparent', ...corners, selectable: true, objectCaching: false };
    if (mode === 'blur') {
      shape = blurPool.pop(); shape?.set({ ...common, scaleX: background.scaleX, scaleY: background.scaleY });
      if (shape) { canvas.add(shape); canvas.sendObjectToBack(shape); canvas.sendObjectToBack(background); }
    }
    if (mode === 'rect') { shape = new Rect({ ...common, stroke: color, strokeWidth: 3, rx: 5, ry: 5 }); canvas.add(shape); }
    if (mode === 'ellipse') { shape = new Ellipse({ ...common, stroke: color, strokeWidth: 3, rx: 0, ry: 0 }); canvas.add(shape); }
  });
  canvas.on('mouse:move', event => {
    if (!drawing || !shape || !canvas.isDrawingMode) return;
    const pointer = canvas.getPointer(event.e), width = Math.abs(pointer.x - start.x), height = Math.abs(pointer.y - start.y);
    const left = Math.min(pointer.x, start.x), top = Math.min(pointer.y, start.y);
    if (shape instanceof Rect) shape.set({ width, height, left, top });
    if (shape instanceof Ellipse) shape.set({ rx: width / 2, ry: height / 2, left, top });
    if (shape instanceof FabricImage) {
      const x = Math.max(pointer.x, 0), y = Math.max(pointer.y, 0);
      shape.set({ width: Math.abs(x - start.x) / shape.scaleX, height: Math.abs(y - start.y) / shape.scaleY,
        left: Math.min(x, start.x), top: Math.min(y, start.y),
        cropX: Math.max(Math.min(x, start.x), 0) / shape.scaleX, cropY: Math.max(Math.min(y, start.y), 0) / shape.scaleY });
    }
    canvas.renderAll();
  });
  canvas.on('mouse:up', () => {
    if (disposed) return;
    if (drawing && shape) {
      shape.setCoords(); canvas.setActiveObject(shape); setMode('select'); onMode('select');
      if (shape instanceof FabricImage) void prepareBlur().catch(onError);
    }
    shape = undefined; drawing = false; canvas.renderAll(); void flush().catch(onError);
  });
  keydown = event => {
    if (!['Delete', 'Backspace'].includes(event.key) || disposed || !enabled) return;
    if (event.composedPath().some(node => node instanceof HTMLElement &&
      (node.matches('input,textarea,select') || node.isContentEditable))) return;
    const selected = canvas.getActiveObjects().filter(object => object !== background);
    if (!selected.length) return;
    event.preventDefault(); event.stopPropagation(); canvas.discardActiveObject();
    canvas.remove(...selected); canvas.renderAll(); void flush().catch(onError);
  };
  holder.addEventListener('keydown', keydown);
  fit(); setMode(mode); await prepareBlur();
  if (disposed) throw new DOMException('Aborted', 'AbortError');
  observer = new ResizeObserver(fit); observer.observe(holder);
  return { flush, dispose, setMode, setEnabled(value: boolean) {
    enabled = value; canvas.skipTargetFind = !enabled; setMode(mode);
  }, setColor(next: string) {
    color = next; brush.color = next;
    canvas.getActiveObjects().forEach(object => { if (!(object instanceof FabricImage)) object.set('stroke', next); });
    setMode(mode); canvas.renderAll(); void flush().catch(onError);
  }, clear() {
    canvas.discardActiveObject(); canvas.remove(...canvas.getObjects().filter(object => object !== background));
    canvas.renderAll(); return flush();
  } };
  } catch (error) { dispose(); throw error; }
}
