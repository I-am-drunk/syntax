import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import css from './report.css?inline';
import localCss from './reportLocal.css?inline';
import './fonts.css';

export function ReportShadow({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<ShadowRoot>();
  useLayoutEffect(() => {
    const host = document.createElement('div');
    host.dataset.reportHost = ''; host.setAttribute('data-html2canvas-ignore', 'true');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host); setRoot(shadow);
    return () => host.remove();
  }, []);
  return root ? createPortal(<><style>{css + localCss}</style>{children}</>, root) : null;
}
