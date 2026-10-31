/**
 * Right-hand panel of the sign-in pages: the subscription lifecycle (SUB-3) drawn as the billing loop.
 * Statuses are the real ones; each tick on the loop is one invoice period. No sample numbers.
 */

const C = { x: 240, y: 210 };
const R = 150;

/** Point on the loop, angle in degrees clockwise from 12 o'clock. */
function at(deg: number, r = R) {
  const a = (deg * Math.PI) / 180;
  return { x: C.x + r * Math.sin(a), y: C.y - r * Math.cos(a) };
}

const STATIONS = [
  { label: 'Quotation', deg: 250, dx: -16, dy: 5, anchor: 'end' as const },
  { label: 'Confirmed', deg: 310, dx: -16, dy: -6, anchor: 'end' as const },
  { label: 'Active', deg: 10, dx: 16, dy: -10, anchor: 'start' as const, current: true },
  { label: 'Renewal', deg: 180, dx: 0, dy: 30, anchor: 'middle' as const },
];
const INVOICE_TICKS = [40, 60, 80, 100, 120, 140, 160, 200, 220];

export function AuthPanel() {
  const q = at(250);
  const draft = { x: 34, y: 336 };
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-spruce-900 p-10 text-white xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(42rem_30rem_at_85%_0%,rgb(123_224_200/0.16),transparent_65%),radial-gradient(30rem_24rem_at_0%_100%,rgb(20_148_138/0.28),transparent_70%)]"
      />

      <figure className="relative mx-auto w-full max-w-[460px] pt-4">
        <svg viewBox="0 0 440 420" className="w-full" role="img" aria-labelledby="loop-title">
          <title id="loop-title">
            A subscription moves from Draft to Quotation, Confirmed and Active, then is invoiced every period until renewal.
          </title>

          {/* Draft enters the loop */}
          <path d={`M${draft.x} ${draft.y} Q 60 280 ${q.x} ${q.y}`} fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx={draft.x} cy={draft.y} r="5" fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1.5" />
          <text x={draft.x} y={draft.y + 26} textAnchor="middle" className="fill-white/60 text-[13px]">
            Draft
          </text>

          {/* The loop */}
          <circle cx={C.x} cy={C.y} r={R} fill="none" stroke="rgb(123 224 200 / 0.22)" strokeWidth="1.5" />
          <circle cx={C.x} cy={C.y} r={R - 34} fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth="1" />

          {/* One tick per invoice period */}
          {INVOICE_TICKS.map((d) => {
            const a = at(d, R - 7);
            const b = at(d, R + 7);
            return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(123 224 200 / 0.55)" strokeWidth="1.5" strokeLinecap="round" />;
          })}

          {STATIONS.map((s) => {
            const p = at(s.deg);
            return (
              <g key={s.label}>
                {s.current && <circle cx={p.x} cy={p.y} r="14" fill="rgb(123 224 200 / 0.14)" />}
                <circle cx={p.x} cy={p.y} r={s.current ? 7 : 5.5} fill="var(--color-spruce-900)" stroke={s.current ? 'var(--color-mint)' : 'rgb(255 255 255 / 0.7)'} strokeWidth="2" />
                <text
                  x={p.x + s.dx}
                  y={p.y + s.dy}
                  textAnchor={s.anchor}
                  className={s.current ? 'fill-mint text-[14px] font-medium' : 'fill-white/75 text-[13px]'}
                >
                  {s.label}
                </text>
              </g>
            );
          })}

          {/* The one moving thing: a subscription travelling the loop once, coming to rest on Active. */}
          <g className="auth-orbit" style={{ transformOrigin: `${C.x}px ${C.y}px` }}>
            <circle cx={C.x} cy={C.y - R} r="4.5" fill="var(--color-mint)" />
          </g>
        </svg>
        <figcaption className="mt-2 text-center text-[13px] text-white/55">Each tick is an invoice, issued automatically every billing period.</figcaption>
      </figure>

      <div className="relative max-w-md">
        <p className="font-display text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance xl:text-[34px]">
          From quotation to recurring invoice, without the spreadsheet.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-white/65">
          Your team confirms the quotation once. Brightloop invoices it every period, records each payment and shows what is still owed.
        </p>
      </div>
    </div>
  );
}
