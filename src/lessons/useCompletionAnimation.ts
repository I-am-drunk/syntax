import { assetUrl } from '../mpm2d/assetUrl';
import { useEffect, useRef } from 'react';
import { EventType, Rive, RuntimeLoader } from '@rive-app/webgl2';
import type { Event } from '@rive-app/webgl2';

RuntimeLoader.setWasmUrl(assetUrl('/assets/completion/rive.449izq9w_ee8i.wasm'));
RuntimeLoader.setWasmFallbackUrl(null);

type AnimationOptions = {
  color: number; levelNumber: number; mastered: boolean;
  onReveal(): void; onTransition(): void; onError(): void;
};

export function useCompletionAnimation(options: AnimationOptions) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef(options);
  callbacks.current = options;
  const { color, levelNumber, mastered } = options;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false, failed = false, transitioned = false;
    let triggerFrame = 0;
    let animation: Rive | undefined;
    const request = new AbortController();
    const fail = () => {
      if (disposed || failed) return;
      cancelAnimationFrame(triggerFrame); triggerFrame = 0;
      failed = true; callbacks.current.onError();
    };
    const resize = () => animation?.resizeDrawingSurfaceToCanvas();
    const setTheme = () => {
      const mode = animation?.viewModelInstance?.boolean('darkMode');
      if (mode) mode.value = document.documentElement.dataset.theme === 'dark';
    };
    const onEvent = (event: Event) => {
      if (disposed || failed) return;
      const name = (event.data as { name?: string } | undefined)?.name;
      if (name === 'transition_up' && !transitioned) {
        transitioned = true; callbacks.current.onTransition();
      }
      if (['transition_up', 'reveal_title', 'reveal_xp'].includes(name ?? ''))
        callbacks.current.onReveal();
    };
    const sizes = new ResizeObserver(resize);
    const theme = new MutationObserver(setTheme);
    sizes.observe(element);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const load = async () => {
      try {
        const response = await fetch(assetUrl('/assets/completion/endstates.e233a7c3.riv'), { signal: request.signal });
        if (!response.ok) throw new Error('Completion animation unavailable');
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        animation = new Rive({ canvas: element, buffer,
          artboard: 'MAIN_lesson-endstate', stateMachines: 'LessonEndstate',
          autoBind: true, autoplay: false, useOffscreenRenderer: true,
          onLoadError: fail,
          onLoad: () => {
            if (disposed || failed || !animation) return;
            try {
              const vm = animation.viewModelInstance;
              if (!vm) throw new Error('Completion animation has no view model');
              vm.boolean('level')!.value = false;
              vm.boolean('skillCheckMastered')!.value = mastered;
              vm.number('color')!.value = color;
              vm.number('levelNumber')!.value = levelNumber;
              setTheme(); resize();
              animation.on(EventType.RiveEvent, onEvent);
              animation.play();
              const names = ['kojiFlip', 'koji360', 'kojiSpin'];
              const name = names[Math.floor(Math.random() * names.length)];
              triggerFrame = requestAnimationFrame(() => {
                triggerFrame = 0;
                if (disposed || failed) return;
                try { vm.trigger(name)?.trigger(); }
                catch { /* The captured safeTrigger also suppresses trigger errors. */ }
              });
            } catch { fail(); }
          },
        });
      } catch { if (!disposed) fail(); }
    };
    void load();
    return () => {
      disposed = true; request.abort(); sizes.disconnect(); theme.disconnect();
      cancelAnimationFrame(triggerFrame);
      animation?.off(EventType.RiveEvent, onEvent);
      animation?.cleanup();
    };
  }, [color, levelNumber, mastered]);
  return canvas;
}
