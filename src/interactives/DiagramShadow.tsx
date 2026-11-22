import { useId } from 'react';

export function DiagramShadow() {
  const id = useId();
  return <>
    <defs><filter id={id} x="-100%" y="-100%" width="300%" height="300%"
      filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feBlend in="SourceGraphic" mode="normal" result="shape" />
      <feColorMatrix in="SourceAlpha" type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
      <feMorphology radius="0" operator="dilate" in="SourceAlpha" />
      <feOffset dx="0" dy="4" /><feGaussianBlur stdDeviation="12" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
      <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
      <feBlend in2="shape" mode="normal" />
    </filter></defs>
    <g filter={`url(#${id})`} />
  </>;
}
