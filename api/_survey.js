// The post-visit feedback survey. Questions live here so the page, the API and
// the backend agree. Answers are stored compact (short keys, capped text) in the
// ticket's folder, see _store.js. Env:
//   SURVEY_DELAY_MIN  minutes after the bartender redeems before the email goes (default 120)
const COCKTAILS = [
  'Frozen Espresso Martini', 'The Opalite', 'Signature Skinny Margarita', 'Cafe 43', 'The Greenhouse', 'Bad Bunny',
  'Espresso Martini', 'Riviera Spritz', 'Neighborhood Margarita', 'Sunset Sangria', 'Hot Girl Pickle Margarita',
];
const RETURN = ['Already planning it', 'Probably', 'Not sure yet'];

// key, label, kind, extra. Stars are 1 to 5, sliders 0 to 10, text capped.
const QUESTIONS = [
  { key: 'overall', q: 'How was the night, all in?', kind: 'stars', required: true },
  { key: 'drinks', q: 'Which cocktails did you try?', kind: 'drinks', hint: 'Tap each one and give it stars.' },
  { key: 'sweet', q: 'How did the cocktails land?', kind: 'slider', lo: 'Too dry', hi: 'Too sweet', mid: 'Just right' },
  { key: 'strong', q: '', kind: 'slider', lo: 'Too light', hi: 'Too strong', mid: 'Just right' },
  { key: 'food', q: 'And the food?', kind: 'stars' },
  { key: 'service', q: 'How did the team take care of you?', kind: 'stars' },
  { key: 'recommend', q: 'Would you send a neighbor our way?', kind: 'nps', lo: 'Not yet', hi: 'In a heartbeat', required: true },
  { key: 'change', q: 'If you could change one thing about the cocktails, what would it be?', kind: 'text', max: 240 },
  { key: 'keep', q: 'What should we never touch?', kind: 'text', max: 240 },
  { key: 'back', q: 'Will we see you again?', kind: 'choice', options: RETURN },
];

const delayMin = () => { const n = parseInt(process.env.SURVEY_DELAY_MIN, 10); return Number.isNaN(n) ? 120 : Math.max(0, n); };

const star = (v) => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };
const ten = (v) => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return n >= 0 && n <= 10 ? n : null; };
// Capped in bytes, not characters: the answers travel in a Blob pathname (950 max), and emoji are wide.
const text = (v, max) => { let t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); while (Buffer.byteLength(t, 'utf8') > max) t = t.slice(0, -1); return t; };

// Validates and compacts what the page sends. Returns { answers } or { error }.
function clean(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'bad_answers' };
  const a = {};
  const overall = star(raw.overall); if (!overall) return { error: 'overall_required' };
  const recommend = ten(raw.recommend); if (recommend == null) return { error: 'recommend_required' };
  a.o = overall; a.r = recommend;
  const d = {};
  if (raw.drinks && typeof raw.drinks === 'object') {
    for (const [name, v] of Object.entries(raw.drinks)) { const i = COCKTAILS.indexOf(name); const s = star(v); if (i >= 0 && s) d[i] = s; }
  }
  if (Object.keys(d).length) a.d = d;
  const sw = ten(raw.sweet); if (sw != null) a.sw = sw;
  const st = ten(raw.strong); if (st != null) a.st = st;
  const f = star(raw.food); if (f) a.f = f;
  const s = star(raw.service); if (s) a.s = s;
  const c = text(raw.change, 240); if (c) a.c = c;
  const k = text(raw.keep, 240); if (k) a.k = k;
  const b = RETURN.indexOf(raw.back); if (b >= 0) a.b = b;
  return { answers: a };
}

// The stored shape, spelled out for the page and the backend.
function expand(a) {
  if (!a) return null;
  return {
    overall: a.o || null, recommend: a.r == null ? null : a.r,
    drinks: Object.fromEntries(Object.entries(a.d || {}).map(([i, v]) => [COCKTAILS[Number(i)], v]).filter(([n]) => n)),
    sweet: a.sw == null ? null : a.sw, strong: a.st == null ? null : a.st,
    food: a.f || null, service: a.s || null, change: a.c || '', keep: a.k || '', back: a.b == null ? '' : RETURN[a.b] || '',
  };
}

// Tickets whose feedback email is due: redeemed long enough ago, we have an address, not sent yet.
const due = (t, now = Date.now()) => !!(t && t.redeemed && t.redeemedAt && t.email && !t.surveySentAt && now - t.redeemedAt >= delayMin() * 60000);

module.exports = { COCKTAILS, RETURN, QUESTIONS, delayMin, clean, expand, due };
