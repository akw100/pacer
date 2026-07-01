import type { CSSProperties, ReactNode } from 'react';
import type { DesignSystem, Page, SlideMeta, SlideTransition } from '@open-slide/core';
import { useSlidePageNumber } from '@open-slide/core';

// ─── Pacer design system ──────────────────────────────────────────────────────
// Mirrors apps/web/src/theme/tokens.css — warm off-white surface, ink text,
// coral accent, Cabinet Grotesk display + Inter body. Edit live from the
// Design panel; consumed via var(--osd-*).
export const design: DesignSystem = {
  palette: {
    bg: '#FAF8F5',
    text: '#1F2733',
    accent: '#FF5A36',
  },
  fonts: {
    display: '"Cabinet Grotesk", "Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
  },
  typeScale: {
    hero: 150,
    body: 36,
  },
  radius: 24,
};

// Supporting tones outside the panel-tweakable set stay as plain consts.
const PANEL = '#FFFFFF';
const INK = '#1F2733';
const MUTED = '#8A93A2';
const CORAL = '#FF5A36';
const GREEN = '#52A869';
const AMBER = '#F5A623';
const BLUE = '#229ED9'; // one cool tone — Telegram / realtime
const BORDER = '#E8E4DF';

// ─── Webfonts + animation CSS, injected once into <head> ──────────────────────
// (Per open-slide guidance: never render <link>/<style> inside a per-page
// component — every page mounts live, so do it once at module load.)
const ANIM_CSS = `
@keyframes pc-up   { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes pc-in   { from { opacity: 0; } to { opacity: 1; } }
@keyframes pc-pop  {
  0%   { opacity: 0; transform: scale(.6) rotate(var(--rot, 0deg)); }
  60%  { opacity: 1; transform: scale(1.06) rotate(var(--rot, 0deg)); }
  100% { opacity: 1; transform: scale(1) rotate(var(--rot, 0deg)); }
}
@keyframes pc-float {
  0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
  50%      { transform: translateY(-16px) rotate(var(--rot, 0deg)); }
}
@keyframes pc-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes pc-flow { to { stroke-dashoffset: -160; } }
@keyframes pc-ring {
  0%   { box-shadow: 0 0 0 0 rgba(82,168,105,.5); }
  70%  { box-shadow: 0 0 0 16px rgba(82,168,105,0); }
  100% { box-shadow: 0 0 0 0 rgba(82,168,105,0); }
}
.pc-up    { opacity: 0; animation: pc-up   .7s cubic-bezier(.2,.7,.2,1) forwards; }
.pc-in    { opacity: 0; animation: pc-in   1s ease forwards; }
.pc-pop   { opacity: 0; animation: pc-pop  .6s cubic-bezier(.34,1.56,.64,1) forwards; }
.pc-float { animation: pc-float 4.5s ease-in-out infinite; }
.pc-grow  { transform: scaleY(0); transform-origin: bottom; animation: pc-grow .9s cubic-bezier(.2,.7,.2,1) forwards; }
.pc-flow  { stroke-dasharray: 2 14; animation: pc-flow 2.6s linear infinite; }
.pc-ring  { animation: pc-ring 2.6s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .pc-up, .pc-in, .pc-pop, .pc-grow { animation-duration: .01ms; opacity: 1; }
  .pc-float, .pc-flow, .pc-ring { animation: none; }
}
`;

const FONTS: [string, string][] = [
  ['pc-font-cabinet', 'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400&display=swap'],
  ['pc-font-inter', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'],
];

if (typeof document !== 'undefined') {
  for (const [id, href] of FONTS) {
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }
  if (!document.getElementById('pc-anim')) {
    const style = document.createElement('style');
    style.id = 'pc-anim';
    style.textContent = ANIM_CSS;
    document.head.appendChild(style);
  }
}

// ─── Shared style atoms ───────────────────────────────────────────────────────
const fill: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  fontFamily: 'var(--osd-font-body)',
};

const display: CSSProperties = {
  fontFamily: 'var(--osd-font-display)',
  fontWeight: 800,
  letterSpacing: '-0.03em',
};

const heading: CSSProperties = { ...display, fontSize: 86, lineHeight: 1.04, margin: 0 };

const card: CSSProperties = {
  background: PANEL,
  border: `1px solid ${BORDER}`,
  borderRadius: 28,
  boxShadow: '0 26px 50px -30px rgba(31,39,51,0.28)',
};

// ─── Shared chrome ────────────────────────────────────────────────────────────
const Warmth = () => (
  <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', width: 820, height: 820, left: -200, top: -260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,90,54,0.13), transparent 70%)' }} />
    <div style={{ position: 'absolute', width: 760, height: 760, right: -220, bottom: -260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.14), transparent 70%)' }} />
    <div style={{ position: 'absolute', width: 560, height: 560, right: '34%', top: '46%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(82,168,105,0.10), transparent 70%)' }} />
  </div>
);

const Eyebrow = ({ children, color = CORAL, className, style }: { children: ReactNode; color?: string; className?: string; style?: CSSProperties }) => (
  <div className={className} style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color, ...style }}>
    {children}
  </div>
);

const PageNum = () => {
  const { current, total } = useSlidePageNumber();
  return (
    <div style={{ position: 'absolute', right: 60, bottom: 44, fontSize: 22, color: MUTED, fontWeight: 600, letterSpacing: '0.03em' }}>
      <span style={{ color: CORAL }}>Pacer</span> · {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  );
};

const Sticker = ({ emoji, bg = PANEL, rot = 0, size = 116, delay = 0, float = false }: { emoji: string; bg?: string; rot?: number; size?: number; delay?: number; float?: boolean }) => (
  <div
    className={float ? 'pc-float' : 'pc-pop'}
    style={{
      ['--rot' as string]: `${rot}deg`,
      animationDelay: `${delay}s`,
      width: size,
      height: size,
      borderRadius: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
      background: bg,
      border: `1px solid ${BORDER}`,
      boxShadow: '0 18px 38px -18px rgba(31,39,51,0.32)',
    } as CSSProperties}
  >
    {emoji}
  </div>
);

// ═══ 1. Cover ═════════════════════════════════════════════════════════════════
const Cover: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', left: 156, top: 196 }}><Sticker emoji="🏃‍♀️" rot={-8} delay={0.2} float /></div>
    <div style={{ position: 'absolute', right: 196, top: 168 }}><Sticker emoji="🔥" bg="rgba(245,166,35,0.18)" rot={10} delay={0.5} float /></div>
    <div style={{ position: 'absolute', right: 244, bottom: 206 }}><Sticker emoji="🏅" rot={-6} delay={0.8} float /></div>
    <div style={{ position: 'absolute', left: 232, bottom: 184 }}><Sticker emoji="👟" bg="rgba(82,168,105,0.16)" rot={8} delay={1.0} float /></div>

    <div style={{ position: 'absolute', inset: 0, padding: '0 160px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <Eyebrow className="pc-up" style={{ animationDelay: '0.05s' }}>A fitness app for the whole family</Eyebrow>
      <h1 className="pc-up" style={{ ...display, animationDelay: '0.15s', fontSize: 232, lineHeight: 0.95, letterSpacing: '-0.045em', margin: '22px 0 0' }}>
        Pacer<span style={{ color: 'var(--osd-accent)' }}>.</span>
      </h1>
      <p className="pc-up" style={{ animationDelay: '0.32s', marginTop: 28, fontSize: 40, lineHeight: 1.4, maxWidth: 1180 }}>
        One running log for the whole family — whatever phone, watch, or app each of you runs with.
      </p>
      <div className="pc-up" style={{ animationDelay: '0.5s', marginTop: 44, fontSize: 24, color: MUTED, fontWeight: 600, letterSpacing: '0.05em' }}>
        Ayelet&nbsp;·&nbsp;Natan&nbsp;·&nbsp;Omri&nbsp;·&nbsp;Shaked
      </div>
    </div>
  </div>
);

// ═══ 2. The problem ═══════════════════════════════════════════════════════════
const SiloCard = ({ emoji, app, owner, delay }: { emoji: string; app: string; owner: string; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, flex: 1, padding: '34px 22px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
    <span style={{ fontSize: 64 }}>{emoji}</span>
    <div style={{ ...display, fontSize: 26, color: INK }}>{app}</div>
    <div style={{ fontSize: 21, color: MUTED, display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 18 }}>🔒</span>{owner}</div>
  </div>
);

const Problem: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '104px 130px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">The problem</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>There's no one place for all of it.</h2>
      <div className="pc-up" style={{ animationDelay: '0.16s', marginTop: 18, fontSize: 30, color: MUTED, maxWidth: 1480 }}>
        Everyone in the family tracks somewhere different — and none of the apps talk to each other:
      </div>
      <div style={{ marginTop: 36, display: 'flex', gap: 26 }}>
        <SiloCard emoji="📱" app="Samsung Health" owner="Mom's phone" delay={0.24} />
        <SiloCard emoji="🍎" app="Apple Fitness" owner="Dad's watch" delay={0.32} />
        <SiloCard emoji="⌚" app="Garmin" owner="Yuval's runs" delay={0.4} />
        <SiloCard emoji="🤷" app="No app at all" owner="Dana, mostly" delay={0.48} />
      </div>
      <div className="pc-up" style={{ animationDelay: '0.6s', marginTop: 40, display: 'flex', gap: 40 }}>
        <div style={{ flex: 1, fontSize: 24, lineHeight: 1.4 }}>
          <span style={{ ...display, fontSize: 24, color: CORAL }}>No unified dashboard.</span>{' '}
          <span style={{ color: INK }}>Nowhere to see the whole family's running in one view.</span>
        </div>
        <div style={{ flex: 1, fontSize: 24, lineHeight: 1.4 }}>
          <span style={{ ...display, fontSize: 24, color: CORAL }}>No simple way to sync.</span>{' '}
          <span style={{ color: INK }}>No easy path to pull it all together and keep it in step.</span>
        </div>
        <div style={{ flex: 1, fontSize: 24, lineHeight: 1.4 }}>
          <span style={{ ...display, fontSize: 24, color: CORAL }}>Solo or together — not both.</span>{' '}
          <span style={{ color: INK }}>Everyone wants their own plan and schedule, and still to train together and compete.</span>
        </div>
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 4. The idea ══════════════════════════════════════════════════════════════
const InputChip = ({ emoji, label, delay }: { emoji: string; label: string; delay: number }) => (
  <div className="pc-up" style={{ animationDelay: `${delay}s`, display: 'inline-flex', alignItems: 'center', gap: 14, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '16px 26px', fontSize: 26, fontWeight: 600, color: INK, boxShadow: '0 18px 36px -26px rgba(31,39,51,0.28)' }}>
    <span style={{ fontSize: 32 }}>{emoji}</span>{label}
  </div>
);

const Idea: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '116px 140px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">The idea</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 16, maxWidth: 1400 }}>All your progress, in one place.</h2>
      <p className="pc-up" style={{ animationDelay: '0.18s', marginTop: 28, fontSize: 36, lineHeight: 1.5, maxWidth: 1480, color: INK }}>
        Log however you like — on the web, by texting our Telegram bot a photo of your watch, or just
        out loud — and every run, workout and habit lands in <span style={{ ...display, fontSize: 36, color: CORAL }}>your</span> dashboard,
        stored in real meters &amp; seconds. The twist: it holds everyone else's progress too, right beside yours.
      </p>
      <div style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        <InputChip emoji="🌐" label="Web" delay={0.32} />
        <InputChip emoji="✈️" label="Telegram photo" delay={0.4} />
        <InputChip emoji="🎙️" label="Voice" delay={0.48} />
        <span className="pc-up" style={{ animationDelay: '0.56s', fontSize: 40, color: MUTED }}>→</span>
        <div className="pc-up" style={{ animationDelay: '0.62s', display: 'inline-flex', alignItems: 'center', gap: 14, background: CORAL, color: '#fff', borderRadius: 999, padding: '16px 30px', fontSize: 27, fontWeight: 700, boxShadow: '0 22px 44px -22px rgba(255,90,54,0.7)' }}>
          <span style={{ fontSize: 32 }}>🏠</span>Your dashboard
        </div>
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 5. The loop ══════════════════════════════════════════════════════════════
const LoopStep = ({ emoji, n, title, body, tone, delay }: { emoji: string; n: string; title: string; body: string; tone: string; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, flex: 1, padding: '40px 34px', display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ width: 96, height: 96, borderRadius: 26, background: `${tone}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50 }}>{emoji}</div>
    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', color: tone }}>{n}</div>
    <div style={{ ...display, fontSize: 46 }}>{title}</div>
    <div style={{ fontSize: 26, lineHeight: 1.45, color: MUTED }}>{body}</div>
  </div>
);

const Loop: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '116px 130px', display: 'flex', flexDirection: 'column' }}>
      <h2 className="pc-up" style={{ ...heading }}>Log <span style={{ color: MUTED }}>→</span> See <span style={{ color: MUTED }}>→</span> Compete</h2>
      <div style={{ marginTop: 60, display: 'flex', gap: 30, alignItems: 'stretch' }}>
        <LoopStep emoji="🏃" n="01 · LOG" title="Log" body="A run, a workout, or a daily habit — from the web, a Telegram photo, or your voice." tone={CORAL} delay={0.2} />
        <LoopStep emoji="📈" n="02 · SEE" title="See" body="Personal, family and community stats update live — scores, streaks, trends." tone={GREEN} delay={0.32} />
        <LoopStep emoji="🔥" n="03 · COMPETE" title="Compete" body="A weekly score, a family leaderboard, challenges, and 👏🔥💪 kudos on the feed." tone={AMBER} delay={0.44} />
      </div>
      <div className="pc-up" style={{ animationDelay: '0.6s', marginTop: 44, fontSize: 27, color: MUTED, textAlign: 'center' }}>
        ↻&nbsp; A little friendly competition is what brings everyone back tomorrow.
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 6. A look inside ═════════════════════════════════════════════════════════
const Feature = ({ emoji, label, sub, delay }: { emoji: string; label: string; sub: string; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 24 }}>
    <span style={{ fontSize: 40 }}>{emoji}</span>
    <div style={{ fontSize: 25, fontWeight: 700, color: INK, marginTop: 4 }}>{label}</div>
    <div style={{ fontSize: 19, color: MUTED, lineHeight: 1.3 }}>{sub}</div>
  </div>
);

const Inside: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '104px 120px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">A look inside</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>What Pacer does today</h2>
      <div style={{ marginTop: 52, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr 1fr', gap: 22 }}>
        <Feature emoji="🏃" label="Runs & workouts" sub="Distance, pace, exertion, sets" delay={0.16} />
        <Feature emoji="✅" label="Daily habits" sub="Stretch, nutrition, your own" delay={0.22} />
        <Feature emoji="⭐" label="Weekly score" sub="Effort, not just distance" delay={0.28} />
        <Feature emoji="🏆" label="Groups & board" sub="Family leaderboard, live" delay={0.34} />
        <Feature emoji="📣" label="Activity feed" sub="Kudos with 👏 🔥 💪" delay={0.4} />
        <Feature emoji="🎯" label="Challenges" sub="With embedded YouTube" delay={0.46} />
        <Feature emoji="🗓️" label="Training plans" sub="Progressive run ramps" delay={0.52} />
        <Feature emoji="📊" label="Records & calendar" sub="PRs and a month view" delay={0.58} />
        <Feature emoji="✈️" label="Telegram bot" sub="Text or photo your run" delay={0.64} />
        <Feature emoji="🎙️" label="AI assistant" sub="Chat & hands-free voice" delay={0.7} />
      </div>
      <div className="pc-up" style={{ animationDelay: '0.84s', marginTop: 30, fontSize: 23, color: MUTED }}>
        …and more on the way — a few of these are still in progress.
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 7. Spotlight: the competitive glue ═══════════════════════════════════════
const ScoreRow = ({ action, pts, delay }: { action: string; pts: string; delay: number }) => (
  <div className="pc-up" style={{ animationDelay: `${delay}s`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${BORDER}` }}>
    <span style={{ fontSize: 25, color: INK }}>{action}</span>
    <span style={{ ...display, fontSize: 26, color: CORAL }}>{pts}</span>
  </div>
);

const LeaderRow = ({ rank, emoji, name, score, pct, tone, arrow, delay }: { rank: number; emoji: string; name: string; score: number; pct: number; tone: string; arrow: string; delay: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '9px 0' }}>
    <span style={{ ...display, fontSize: 24, color: MUTED, width: 28 }}>{rank}</span>
    <span style={{ fontSize: 34 }}>{emoji}</span>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 23, fontWeight: 600, color: INK }}>{name} <span style={{ color: tone, fontSize: 18 }}>{arrow}</span></span>
        <span style={{ ...display, fontSize: 24, color: INK }}>{score}</span>
      </div>
      <div style={{ height: 12, borderRadius: 999, background: '#F1ECE6', overflow: 'hidden' }}>
        <div className="pc-grow" style={{ animationDelay: `${delay}s`, height: '100%', width: `${pct}%`, borderRadius: 999, background: tone }} />
      </div>
    </div>
  </div>
);

const Scoring: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '100px 130px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">The competitive glue</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14, fontSize: 76 }}>Everyone competes — not just the runner.</h2>
      <div style={{ marginTop: 40, display: 'flex', gap: 56, alignItems: 'stretch' }}>
        <div className="pc-up" style={{ animationDelay: '0.18s', flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginBottom: 8 }}>The weekly score</div>
          <ScoreRow action="Run logged" pts="10 + 1/km" delay={0.24} />
          <ScoreRow action="Workout logged" pts="10" delay={0.3} />
          <ScoreRow action="Habit completed" pts="3 / day" delay={0.36} />
          <ScoreRow action="All habits in a day" pts="+2" delay={0.42} />
          <ScoreRow action="Plan run on schedule" pts="+5" delay={0.48} />
          <ScoreRow action="7-day streak" pts="+10" delay={0.54} />
        </div>
        <div style={{ ...card, flex: 1.05, padding: '28px 30px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ ...display, fontSize: 28 }}>This week · the family</span>
            <span className="pc-ring" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 600, color: GREEN, background: 'rgba(82,168,105,0.12)', borderRadius: 999, padding: '6px 14px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: GREEN }} />live
            </span>
          </div>
          <LeaderRow rank={1} emoji="🦊" name="Dana" score={248} pct={100} tone={CORAL} arrow="▲" delay={0.4} />
          <LeaderRow rank={2} emoji="🐻" name="Dad" score={221} pct={89} tone={GREEN} arrow="▲" delay={0.5} />
          <LeaderRow rank={3} emoji="🐼" name="Yuval" score={196} pct={79} tone={AMBER} arrow="▼" delay={0.6} />
          <LeaderRow rank={4} emoji="🐰" name="Mom" score={174} pct={70} tone={BLUE} arrow="▲" delay={0.7} />
          <div className="pc-pop" style={{ animationDelay: '1s', position: 'absolute', right: 26, bottom: 22, background: INK, color: '#fff', borderRadius: 999, padding: '10px 18px', fontSize: 20, fontWeight: 700, boxShadow: '0 18px 34px -16px rgba(31,39,51,0.5)' }}>
            +15 pts 🎉
          </div>
        </div>
      </div>
      <div className="pc-up" style={{ animationDelay: '0.7s', marginTop: 26, fontSize: 25, color: MUTED }}>
        A simple weekly score means the walker, the swimmer and the marathoner all play the same game.
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 8. Demo ══════════════════════════════════════════════════════════════════
const Demo: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '0 150px', display: 'flex', alignItems: 'center', gap: 90 }}>
      <div style={{ flex: 1 }}>
        <Eyebrow className="pc-up">Live demo</Eyebrow>
        <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14, fontSize: 100 }}>Let's open it.</h2>
        <p className="pc-up" style={{ animationDelay: '0.18s', marginTop: 26, fontSize: 32, lineHeight: 1.5, color: INK, maxWidth: 640 }}>
          Nothing to install — Pacer runs in any browser, on any phone or laptop, and you can log a
          run straight from Telegram. Enough slides — let's open the real thing.
        </p>
        <a className="pc-up" href="https://pacer-web-production-b697.up.railway.app/" target="_blank" rel="noopener noreferrer" style={{ animationDelay: '0.3s', marginTop: 34, display: 'inline-flex', alignItems: 'center', gap: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '14px 24px', fontSize: 23, fontWeight: 600, color: INK, textDecoration: 'none', boxShadow: '0 18px 36px -26px rgba(31,39,51,0.3)' }}>
          <span style={{ fontSize: 24 }}>🔗</span> pacer-web-production-b697.up.railway.app
        </a>
      </div>

      {/* Phone — live preview of the real production site */}
      <div className="pc-pop" style={{ animationDelay: '0.2s', width: 372, height: 744, background: '#FAF8F5', border: `1px solid ${BORDER}`, borderRadius: 52, padding: 14, boxShadow: '0 50px 90px -40px rgba(31,39,51,0.45)', display: 'flex', flexShrink: 0, overflow: 'hidden' }}>
        <iframe
          src="https://pacer-web-production-b697.up.railway.app/"
          title="Pacer — live production site"
          loading="lazy"
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 40, background: '#FAF8F5' }}
        />
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 9. Architecture ══════════════════════════════════════════════════════════
const Node = ({ x, y, w = 234, accent, emoji, title, sub, delay = 0 }: { x: number; y: number; w?: number; accent: string; emoji: string; title: string; sub: string; delay?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: 2 }}>
    <div className="pc-pop" style={{ animationDelay: `${delay}s`, width: w, background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `6px solid ${accent}`, borderRadius: 18, padding: '14px 18px', boxShadow: '0 18px 40px -24px rgba(31,39,51,0.34)', display: 'flex', gap: 13, alignItems: 'center' }}>
      <span style={{ fontSize: 34 }}>{emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...display, fontSize: 23, color: INK }}>{title}</div>
        <div style={{ fontSize: 15, color: MUTED, marginTop: 2, lineHeight: 1.25 }}>{sub}</div>
      </div>
    </div>
  </div>
);

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
};

const Edge = ({ d, color, delay = 0 }: { d: string; color: string; delay?: number }) => (
  <>
    <path d={d} fill="none" stroke={BORDER} strokeWidth={3} />
    <path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" className="pc-flow" style={{ animationDelay: `${delay}s` }} />
  </>
);

const Architecture: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', left: 120, top: 64 }}>
      <Eyebrow className="pc-up">Architecture</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 12, fontSize: 72 }}>How Pacer is wired, end to end</h2>
    </div>

    {/* connectors */}
    <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
      <Edge d={curve(360, 300, 600, 600)} color={CORAL} delay={0} />
      <Edge d={curve(770, 300, 940, 600)} color={BLUE} delay={0.2} />
      <Edge d={curve(1180, 300, 980, 600)} color={INK} delay={0.4} />
      <Edge d="M 1600 322 C 1800 560, 1460 860, 1170 880" color={AMBER} delay={0.6} />
      <Edge d="M 720 600 L 840 600" color={CORAL} delay={0.1} />
      <Edge d="M 1080 600 L 1224 600" color={CORAL} delay={0.3} />
      <Edge d="M 960 642 L 960 850" color={GREEN} delay={0.5} />
      <Edge d={curve(602, 640, 770, 858)} color={GREEN} delay={0.7} />
    </svg>

    {/* Railway boundary */}
    <div style={{ position: 'absolute', left: 468, top: 512, width: 1016, height: 176, border: `2px dashed ${MUTED}`, borderRadius: 30, background: 'rgba(31,39,51,0.025)', zIndex: 1 }} />
    <div style={{ position: 'absolute', left: 486, top: 492, background: INK, color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: '0.1em', padding: '7px 15px', borderRadius: 999, zIndex: 3 }}>🚂 RAILWAY</div>

    {/* nodes */}
    <Node x={360} y={300} accent={CORAL} emoji="📱" title="Family phones" sub="Open in any browser" delay={0.15} />
    <Node x={770} y={300} accent={BLUE} emoji="✈️" title="Telegram" sub="grammY webhook bot" delay={0.25} />
    <Node x={1180} y={300} accent={INK} emoji="🤖" title="OpenAI" sub="Parsing · vision · voice" delay={0.35} />
    <Node x={1600} y={300} accent={AMBER} emoji="🔐" title="Google Cloud" sub="OAuth sign-in" delay={0.45} />

    <Node x={600} y={600} accent={CORAL} emoji="🌐" title="pacer-web" sub="React 19 · Vite" delay={0.3} />
    <Node x={960} y={600} w={250} accent={CORAL} emoji="⚙️" title="pacer-api" sub="Hono · the hub" delay={0.2} />
    <Node x={1340} y={600} accent={CORAL} emoji="🎬" title="pacer-frames" sub="Python · yt-dlp · ffmpeg" delay={0.4} />

    <Node x={960} y={880} w={460} accent={GREEN} emoji="🗄️" title="Supabase" sub="Postgres · Auth · Realtime · Storage" delay={0.55} />

    <div className="pc-up" style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', animationDelay: '0.9s', fontSize: 22, color: MUTED }}>
      Everything in the Railway box deploys straight from git — merge to <b style={{ color: INK }}>dev</b> = staging, merge to <b style={{ color: INK }}>main</b> = production.
    </div>
  </div>
);

// ═══ 10. Data model ═══════════════════════════════════════════════════════════
const TableChip = ({ name }: { name: string }) => (
  <div style={{ fontSize: 18, color: INK, background: '#FAF8F5', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', fontFamily: 'var(--osd-font-body)' }}>{name}</div>
);

const GroupCard = ({ emoji, title, accent, children, delay }: { emoji: string; title: string; accent: string; children: ReactNode; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: `6px solid ${accent}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 30 }}>{emoji}</span>
      <span style={{ ...display, fontSize: 26 }}>{title}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
);

const DataModel: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '96px 110px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">Under the hood</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>The data model</h2>
      <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 22, alignItems: 'start' }}>
        <GroupCard emoji="👤" title="You" accent={CORAL} delay={0.16}>
          <TableChip name="profiles" />
        </GroupCard>
        <GroupCard emoji="🏃" title="Activity" accent={GREEN} delay={0.24}>
          <TableChip name="runs" />
          <TableChip name="workouts" />
          <TableChip name="workout_sets" />
          <TableChip name="habits" />
          <TableChip name="habit_checks" />
        </GroupCard>
        <GroupCard emoji="🗓️" title="Plans" accent={AMBER} delay={0.32}>
          <TableChip name="running_plans" />
          <TableChip name="plan_runs" />
          <TableChip name="workout_plans" />
          <TableChip name="workout_plan_slots" />
          <TableChip name="video_routines" />
        </GroupCard>
        <GroupCard emoji="👨‍👩‍👧" title="Social" accent={BLUE} delay={0.4}>
          <TableChip name="groups" />
          <TableChip name="group_members" />
          <TableChip name="group_invites" />
          <TableChip name="group_goals" />
          <TableChip name="friendships" />
          <TableChip name="challenges" />
          <TableChip name="challenge_participants" />
          <TableChip name="reactions" />
        </GroupCard>
        <GroupCard emoji="🏁" title="Compete & system" accent={INK} delay={0.48}>
          <TableChip name="races" />
          <TableChip name="race_participants" />
          <TableChip name="score_events" />
          <TableChip name="telegram_links" />
        </GroupCard>
      </div>
      <div className="pc-up" style={{ animationDelay: '0.6s', marginTop: 32, fontSize: 24, color: MUTED, lineHeight: 1.4 }}>
        Store <b style={{ color: INK }}>meters &amp; seconds</b>, derive every display value · row-level security on every table — you see your own rows, plus your group's. <span style={{ color: CORAL, fontWeight: 600 }}>More tables land as new features ship.</span>
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 11. How we worked ════════════════════════════════════════════════════════
const ProcessStep = ({ n, emoji, title, body, delay }: { n: string; emoji: string; title: string; body: string; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, flex: 1, padding: '30px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 42 }}>{emoji}</span>
      <span style={{ ...display, fontSize: 30, color: BORDER }}>{n}</span>
    </div>
    <div style={{ ...display, fontSize: 30 }}>{title}</div>
    <div style={{ fontSize: 22, lineHeight: 1.45, color: MUTED }}>{body}</div>
  </div>
);

const Process: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '110px 110px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">How we built it</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>Structured start, independent finish.</h2>
      <div style={{ marginTop: 54, display: 'flex', gap: 26, alignItems: 'stretch' }}>
        <ProcessStep n="01" emoji="🎨" title="Designed together" body="We specced the whole app in Stitch before writing a single line of code." delay={0.18} />
        <ProcessStep n="02" emoji="🗂️" title="One source of truth" body="Claude-authored docs split the build into self-contained task cards, so four people moved in parallel." delay={0.28} />
        <ProcessStep n="03" emoji="🪝" title="Guardrails" body="Custom hooks & skills branch automatically and open a PR the moment a task ships." delay={0.38} />
        <ProcessStep n="04" emoji="🚀" title="Free rein" body="Everyone grabbed the tasks they wanted and could change anything — it's all built to flex." delay={0.48} />
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 12. Who did what ═════════════════════════════════════════════════════════
const Bullet = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 20, lineHeight: 1.35, color: INK }}>
    <span style={{ color: CORAL, marginTop: 1 }}>{'•Deployment (Railway) '}</span>
    <span>{children}</span>
  </div>
);

const TeamCard = ({ emoji, name, role, tone, bullets, delay }: { emoji: string; name: string; role: string; tone: string; bullets: string[]; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, flex: 1, padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ width: 78, height: 78, borderRadius: 22, background: `${tone}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{emoji}</div>
    <div>
      <div style={{ ...display, fontSize: 32 }}>{name}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: tone, marginTop: 2 }}>{role}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bullets.map((b) => <Bullet key={b}>{b}</Bullet>)}
    </div>
  </div>
);

const Team: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '96px 110px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">The team</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>Who built what</h2>
      <div style={{ marginTop: 40, display: 'flex', gap: 24, alignItems: 'stretch' }}>
        <TeamCard emoji="🧱" name="Ayelet" role="" tone={CORAL} bullets={['Repo, branches & workflow', 'Web shell, theme & dark mode', 'Deployment (Railway)', 'Landing page & this deck', 'Code review — CodeRabbit', 'Voice + YouTube workout flows']} delay={0.18} />
        <TeamCard emoji="🔌" name="Natan" role="" tone={BLUE} bullets={['API server foundation', 'Database, auth & Google sign-in', 'Telegram logging bot + commands', 'Challenges, end to end', 'Live races — the whole feature']} delay={0.28} />
        <TeamCard emoji="⚙️" name="Omri" role="" tone={GREEN} bullets={['Schema + row-level security', 'Records & calendar', 'Running & workout plans', 'Planning screen + plans on Home']} delay={0.38} />
        <TeamCard emoji="📱" name="Shaked" role="" tone={AMBER} bullets={['Logging screens & charts', 'Groups & live leaderboard', 'Realtime activity feed', 'Community stats', 'Pacer Coach — AI chat assistant']} delay={0.48} />
      </div>
      <div className="pc-up" style={{ animationDelay: '0.6s', marginTop: 30, fontSize: 24, color: MUTED, textAlign: 'center' }}>
        Four people, one flexible codebase — and we're just getting started.
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 13. What's next ══════════════════════════════════════════════════════════
const NextChip = ({ emoji, label, delay }: { emoji: string; label: string; delay: number }) => (
  <div className="pc-up" style={{ ...card, animationDelay: `${delay}s`, padding: '22px 22px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 22 }}>
    <span style={{ fontSize: 38 }}>{emoji}</span>
    <span style={{ fontSize: 25, fontWeight: 600, color: INK }}>{label}</span>
  </div>
);

const Next: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', inset: 0, padding: '108px 130px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow className="pc-up">What's next</Eyebrow>
      <h2 className="pc-up" style={{ ...heading, animationDelay: '0.08s', marginTop: 14 }}>We're just getting started.</h2>
      <div style={{ marginTop: 50, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
        <NextChip emoji="⌚" label="Watch & Strava auto-import" delay={0.16} />
        <NextChip emoji="🍎" label="Apple Health / Google Fit" delay={0.22} />
        <NextChip emoji="🗺️" label="Route maps & GPS traces" delay={0.28} />
        <NextChip emoji="🏅" label="Badges & achievements" delay={0.34} />
        <NextChip emoji="🔔" label="Smart reminders & nudges" delay={0.4} />
        <NextChip emoji="📱" label="Native iOS & Android apps" delay={0.46} />
        <NextChip emoji="🔁" label="Adaptive training plans" delay={0.52} />
        <NextChip emoji="✨" label="…and more" delay={0.58} />
      </div>
      <div className="pc-up" style={{ animationDelay: '0.7s', marginTop: 46, fontSize: 27, color: MUTED, lineHeight: 1.45, maxWidth: 1400 }}>
        Built flexible on purpose — the next feature is a new <b style={{ color: INK }}>task card</b>, not a rewrite.
      </div>
    </div>
    <PageNum />
  </div>
);

// ═══ 14. Closing ══════════════════════════════════════════════════════════════
const Closing: Page = () => (
  <div style={fill}>
    <Warmth />
    <div style={{ position: 'absolute', right: 180, top: 180 }}><Sticker emoji="🎉" bg="rgba(245,166,35,0.18)" rot={9} delay={0.4} float /></div>
    <div style={{ position: 'absolute', left: 200, bottom: 190 }}><Sticker emoji="👟" bg="rgba(82,168,105,0.16)" rot={-8} delay={0.6} float /></div>
    <div style={{ position: 'absolute', inset: 0, padding: '0 160px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <h1 className="pc-up" style={{ ...display, fontSize: 168, lineHeight: 0.98, letterSpacing: '-0.04em', margin: 0 }}>
        Run together.<br /><span style={{ color: 'var(--osd-accent)' }}>Even apart.</span>
      </h1>
      <p className="pc-up" style={{ animationDelay: '0.2s', marginTop: 34, fontSize: 36, color: INK }}>
        Thanks — now let's go log a run. 🏃
      </p>
      <div className="pc-up" style={{ animationDelay: '0.34s', marginTop: 36, display: 'inline-flex', alignItems: 'center', gap: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '14px 26px', fontSize: 23, fontWeight: 600, color: INK, boxShadow: '0 18px 36px -26px rgba(31,39,51,0.3)' }}>
        <span style={{ fontSize: 24 }}>🔗</span> pacer-web-production-b697.up.railway.app
      </div>
    </div>
  </div>
);

// ─── Transitions — one quiet DNA across the deck ──────────────────────────────
const EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

export const transition: SlideTransition = {
  duration: 220,
  exit: { duration: 150, easing: EASE_IN, keyframes: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }] },
  enter: { duration: 220, delay: 80, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }] },
};

const settle: SlideTransition = {
  duration: 300,
  exit: { duration: 160, easing: EASE_IN, keyframes: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }] },
  enter: { duration: 300, delay: 100, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }] },
};

Cover.transition = settle;
Closing.transition = settle;

export const meta: SlideMeta = {
  title: 'Pacer — pitch',
  createdAt: '2026-06-28T09:29:31.092Z',
};

export default [
  Cover,
  Problem,
  Idea,
  Loop,
  Inside,
  Scoring,
  Architecture,
  DataModel,
  Process,
  Team,
  Next,
  Demo,
  Closing,
] satisfies Page[];
