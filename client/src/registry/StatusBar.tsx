/** Stacked published / screening / draft bar. Segments are separated by a surface gap; zero segments are omitted. */
export function StatusBar({
  published,
  screening,
  draft,
  max,
  width = 120,
  height = 8,
}: {
  published: number;
  screening: number;
  draft: number;
  max: number;
  width?: number;
  height?: number;
}) {
  const scale = max > 0 ? width / max : 0;
  const segs = [
    { v: published, cls: 'st-published', label: 'published' },
    { v: screening, cls: 'st-screening', label: 'screening' },
    { v: draft, cls: 'st-draft', label: 'draft' },
  ].filter((s) => s.v > 0);
  let x = 0;
  return (
    <svg width={width} height={height} className="status-bar" role="img" aria-label={segs.map((s) => `${s.v} ${s.label}`).join(', ') || 'no parts'}>
      <rect x={0} y={0} width={width} height={height} rx={2} className="status-track" />
      {segs.map((s, i) => {
        const w = Math.max(2, s.v * scale - (i < segs.length - 1 ? 2 : 0));
        const rect = <rect key={s.cls} x={x} y={0} width={w} height={height} rx={2} className={s.cls} />;
        x += w + 2;
        return rect;
      })}
    </svg>
  );
}

export function StatusLegend() {
  return (
    <span className="status-legend">
      <span><i className="sw st-published" /> Published</span>
      <span><i className="sw st-screening" /> Screening</span>
      <span><i className="sw st-draft" /> Draft</span>
    </span>
  );
}
