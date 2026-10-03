interface Props {
  values: number[];
  width?: number;
  height?: number;
  /** Shared y-max so sparklines in a list are comparable; defaults to own max. */
  max?: number;
  label?: string;
}

/** Tiny daily-count bar strip; zero days show as a baseline tick. */
export function Sparkline({ values, width = 84, height = 18, max, label }: Props) {
  const m = Math.max(1, max ?? Math.max(...values));
  const gap = 1;
  const bw = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg className="spark" width={width} height={height} role="img" aria-label={label ?? `daily commits: ${values.join(', ')}`}>
      {values.map((v, i) => {
        const h = v === 0 ? 1 : Math.max(2, (v / m) * height);
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={height - h}
            width={bw}
            height={h}
            rx={v === 0 ? 0 : 1}
            className={v === 0 ? 'spark-zero' : 'spark-bar'}
          >
            <title>{`${values.length - 1 - i === 0 ? 'today' : `${values.length - 1 - i}d ago`}: ${v} commit${v === 1 ? '' : 's'}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
