import { STAGES, STAGE_LABEL, type Stage } from '@/lib/types';

export function StageLabel({ stage }: { stage: Stage }) {
  return <span className={`stage ${stage}`}>{STAGE_LABEL[stage]}</span>;
}

// Five-step progress bar. Feedback counts as part of review; rejected/withdrawn stop where they ended.
export function StageTrack({ stage, reached }: { stage: Stage; reached?: Stage[] }) {
  const order: Stage[] = ['submitted', 'in_review', 'feedback', 'approved', 'awarded'];
  const idx = stage === 'rejected' || stage === 'withdrawn'
    ? Math.max(...(reached ?? ['submitted']).map((s) => order.indexOf(s)))
    : order.indexOf(stage);
  return (
    <div aria-label={`Stage: ${STAGE_LABEL[stage]}`}>
      <div className="track">{STAGES.map((s, i) => <div key={s.key} className={i <= idx ? 'done' : ''} />)}</div>
      <div className="track-labels" aria-hidden>{STAGES.map((s) => <span key={s.key}>{s.label}</span>)}</div>
    </div>
  );
}
