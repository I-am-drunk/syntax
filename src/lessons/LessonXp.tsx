import { useEffect, useRef, useState } from 'react';
import { XpBadgeIcon, XpStar } from './LessonXpIcons';
import './lesson-xp.css';

type Award = { id: number; xp: number };

function DesktopXp({ value }: { value: number }) {
  const [target, setTarget] = useState(value);
  const [displayed, setDisplayed] = useState(value);
  const [awards, setAwards] = useState<Award[]>([]);
  const previous = useRef(value), current = useRef(value), nextId = useRef(1);

  useEffect(() => {
    if (value === previous.current) return;
    const xp = value - previous.current, id = nextId.current++;
    previous.current = value;
    if (xp > 0) setAwards(pending => [...pending, { id, xp }]);
  }, [value]);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    let first: number | undefined, frame: number;
    const tick = (time: number) => {
      first ??= time;
      const elapsed = time - first, progress = Math.min(elapsed / 500, 1);
      const number = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      current.current = number;
      setDisplayed(number);
      if (elapsed < 500) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  const finishAward = (award: Award) => {
    setTarget(total => total + award.xp);
    setAwards(pending => pending.filter(item => item.id !== award.id));
  };
  const earned = displayed > 0;
  return <div className="lesson-xp" aria-label={`${displayed} XP`}>
    <span className="lesson-xp-count" data-earned-xp={earned || undefined}
      style={{ minWidth: `${Math.max(String(displayed).length, 3)}ch` }}>
      {displayed}<span className="lesson-xp-awards">
        {awards.map(award => <span className="lesson-xp-badge" key={award.id}
          onAnimationEnd={event => {
            if (event.currentTarget === event.target) finishAward(award);
          }}>{`+ ${award.xp}`}<XpBadgeIcon /></span>)}
      </span>
    </span>
    <XpStar earned={earned} />
  </div>;
}

export function LessonXp({ value }: { value: number }) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 769px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop ? <DesktopXp value={value} /> : null;
}
