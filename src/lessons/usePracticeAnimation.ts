import { useEffect, useRef } from 'react';
import { EventType, Rive } from '@rive-app/webgl2';
import type { Event } from '@rive-app/webgl2';

type Options = {
  color: number; percentCorrect: number;
  onTitle(): void; onXp(): void; onTransition(): void; onError(): void;
};

export function usePracticeAnimation(options: Options) {
  const canvas = useRef<HTMLCanvasElement>(null), burstCanvas = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef(options); callbacks.current = options;
  const { color, percentCorrect } = options;
  useEffect(() => {
    if (!canvas.current || !burstCanvas.current) return;
    let disposed = false, failed = false, moved = false, burstRequested = false, burstReady = false;
    let main: Rive | undefined, burst: Rive | undefined, triggerFrame = 0;
    const request = new AbortController();
    const fail = () => { if (!disposed && !failed) { failed = true; callbacks.current.onError(); } };
    const resize = () => { main?.resizeDrawingSurfaceToCanvas(); burst?.resizeDrawingSurfaceToCanvas(); };
    const theme = () => {
      const dark = main?.viewModelInstance?.boolean('darkMode');
      if (dark) dark.value = document.documentElement.dataset.theme === 'dark';
    };
    const playBurst = () => {
      if (burstRequested && burstReady) burst?.viewModelInstance?.trigger('playAnimation')?.trigger();
    };
    const event = (value: Event) => {
      if (disposed || failed) return;
      const name = (value.data as { name?: string } | undefined)?.name;
      if (name === 'transition_up' && !moved) { moved = true; callbacks.current.onTransition(); }
      if (name === 'reveal_title') callbacks.current.onTitle();
      if (name === 'reveal_xp' && !burstRequested) {
        burstRequested = true; callbacks.current.onXp(); playBurst();
      }
    };
    const sizes = new ResizeObserver(resize), appearance = new MutationObserver(theme);
    sizes.observe(canvas.current); sizes.observe(burstCanvas.current);
    appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const load = async () => {
      try {
        const response = await fetch('/assets/completion/endstates.e233a7c3.riv', { signal: request.signal });
        if (!response.ok) throw new Error('Practice animation unavailable');
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        if (percentCorrect >= .5) burst = new Rive({ canvas: burstCanvas.current!, buffer, autoBind: true, autoplay: true,
          artboard: 'MAIN_xp-starburst', stateMachines: 'XPStarburst',
          onLoadError: fail, onLoad: () => {
            if (disposed || failed) return;
            burstReady = true; resize(); playBurst();
          },
        });
        main = new Rive({ canvas: canvas.current!, buffer, autoBind: true, autoplay: false,
          artboard: 'MAIN_practice-endstate', stateMachines: 'PracticeEndstate', useOffscreenRenderer: true,
          onLoadError: fail, onLoad: () => {
            if (disposed || failed || !main) return;
            try {
              const vm = main.viewModelInstance;
              if (!vm) throw new Error('Practice animation has no view model');
              vm.boolean('personalizedPractice')!.value = false;
              vm.number('color')!.value = color;
              theme(); resize(); main.on(EventType.RiveEvent, event); main.play();
              triggerFrame = requestAnimationFrame(() => {
                triggerFrame = 0;
                if (disposed || failed) return;
                const trigger = percentCorrect < .5 ? 'playFailure' : percentCorrect < 1 ? 'play50Plus' : 'play100';
                try { vm.trigger(trigger)?.trigger(); } catch { /* Matches the source's safe trigger. */ }
              });
            } catch { fail(); }
          },
        });
      } catch { if (!disposed) fail(); }
    };
    void load();
    return () => {
      disposed = true; request.abort(); cancelAnimationFrame(triggerFrame);
      sizes.disconnect(); appearance.disconnect();
      main?.off(EventType.RiveEvent, event); main?.cleanup(); burst?.cleanup();
    };
  }, [color, percentCorrect]);
  return { canvas, burstCanvas };
}
