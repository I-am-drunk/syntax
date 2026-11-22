import type { GridPage } from './types';
import { explanationPaint, explanationRowFactor } from './explanationPaint';

type Explanation = NonNullable<GridPage['explanation']>;
export function ExplanationCode({ explanation, position }: { explanation: Explanation; position: number }) {
  const count = explanation.repeatCount;
  const program = count ? explanation.program.slice(0, explanation.program.length / count) : explanation.program;
  const headerFactor = explanationRowFactor(explanation, position, 0);
  const header = explanationPaint(headerFactor, [0, 155, 43]);
  const connectorLength = (1.1 * 18.27999973297119 + 4.2) * program.length;
  return <div className="explanation-program" data-authored={Boolean(explanation.mode)} aria-label="Correct program">
    {count && <div className="explanation-repeat explanation-command" data-factor={headerFactor}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill={header} aria-hidden="true">
        <path d="M12.5 3.5H2.5V2.5H13.5V7.79289L15.1464 6.14645L15.8536 6.85355L13 9.70711L10.1464 6.85355L10.8536 6.14645L12.5 7.79289V3.5Z" />
        <path d="M4 12.5L14 12.5L14 13.5L3 13.5L3 8.20711L1.35355 9.85355L0.646446 9.14645L3.5 6.29289L6.35355 9.14645L5.64645 9.85355L4 8.20711L4 12.5Z" />
      </svg>
      <span style={{ color: explanationPaint(headerFactor, [0, 0, 0]) }}><strong style={{ color: header }}>repeat</strong>{' '}
        <span className="explanation-count" style={{ color: explanationPaint(headerFactor, [0, 124, 35]), background: `rgb(242 242 242 / ${.3 + .7 * headerFactor})` }}>{count}</span>{' times'}</span>
      <svg className="explanation-connector" width="4" height={connectorLength} overflow="visible" aria-hidden="true">
        <path d={`M0 0V${connectorLength}h4`} fill="none" stroke={`rgb(204 204 204 / ${.4 + .6 * headerFactor})`} strokeWidth="1" />
      </svg>
    </div>}
    {program.map((command, index) => {
      const factor = explanationRowFactor(explanation, position, index + (count ? 1 : 0));
      const delivery = explanation.mode === 'delivery';
      const verb = command === 'forward' ? delivery ? 'drive' : 'move' : command === 'deliver' ? delivery ? 'deliver' : 'collect' : 'turn';
      const argument = command === 'deliver' ? delivery ? 'package' : 'gem' : command;
      return <div key={index} className="explanation-command" data-command-index={index} data-factor={factor}
        data-indented={Boolean(count)} style={{ color: explanationPaint(factor, [0, 0, 0]) }}>
        <strong style={{ color: explanationPaint(factor, [69, 109, 255]) }}>{verb}</strong>{` ${argument}`}
      </div>;
    })}
  </div>;
}
