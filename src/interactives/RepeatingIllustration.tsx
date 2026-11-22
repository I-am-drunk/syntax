import { useId, useLayoutEffect, useRef, useState } from 'react';
import wide from './repeating-equivalence-wide.svg?raw';
import narrow from './repeating-equivalence-narrow.svg?raw';
import python from './repeating-python.svg?raw';
import debugWide from './debugging-1-desktop.svg?raw';
import debugNarrow from './debugging-1-mobile.svg?raw';
import debugPythonWide from './debugging-2-desktop.svg?raw';
import debugPythonNarrow from './debugging-2-mobile.svg?raw';
import './repeatingIllustration.css';

export function RepeatingIllustration({ kind }: {
  kind: 'repeating-equivalence' | 'repeating-python' | 'debugging-example' | 'debugging-python';
}) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const [large, setLarge] = useState(false);
  useLayoutEffect(() => {
    const node = root.current!;
    const measure = () => setLarge(node.getBoundingClientRect().width >= 492);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  const source = kind === 'debugging-example' ? large ? debugWide : debugNarrow
    : kind === 'debugging-python' ? large ? debugPythonWide : debugPythonNarrow
    : kind === 'repeating-python' ? python : large ? wide : narrow;
  return <div ref={root} className="repeating-illustration" data-kind={kind} role="img"
    aria-label={kind === 'debugging-example' ? 'Compare the first repetition of the buggy and corrected programs'
      : kind === 'debugging-python' ? 'Compare the buggy and corrected Python programs'
      : kind === 'repeating-python' ? 'A repeat loop in pseudocode and Python'
      : 'Repeating drive forward and deliver package three times equals six individual commands'}
    dangerouslySetInnerHTML={{ __html: source.replaceAll('repeating-shadow', id).replaceAll('debugging-shadow', id) }} />;
}
