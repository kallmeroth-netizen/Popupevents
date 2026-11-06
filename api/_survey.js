// The post-visit survey ("your bar tasting notes"). Questions live here so the
// page, the API and the backend agree. Answers are stored as a JSON file per
// response (see _store.js setFeedback). Env:
//   SURVEY_DELAY_MIN  minutes after the bartender redeems before the email goes (default 120)
const MENU = {
  Frozen: ['Frozen Espresso Martini', 'The Opalite'],
  Signatures: ['Signature Skinny Margarita', 'Cafe 43', 'The Greenhouse', 'Bad Bunny', 'Espresso Martini'],
  'The Classics': ['Riviera Spritz', 'Neighborhood Margarita', 'Sunset Sangria', 'Hot Girl Pickle Margarita'],
};
const COCKTAILS = Object.values(MENU).flat();
const AGAIN = ['Yes', 'Maybe', 'No'];
const MENU_ROWS = { variety: 'Variety of options', flavor: 'Range of flavor profiles', value: 'Price / value', clarity: 'Clarity of menu descriptions' };
const SERVICE_ROWS = { knowledge: 'Knowledge of the cocktails', friendliness: 'Friendliness', speed: 'Speed and attentiveness' };
const FOLLOWUP = ['Yes', 'No thanks'];
const TEXT_MAX = 600;

// The four pages, in order. The page renders from this; the API validates against it.
const STEPS = [
  { title: 'Your Bar Order', questions: [
    { key: 'drinks', q: 'Which cocktail(s) did you order?', hint: 'Select all that apply.', kind: 'cocktails', required: true, error: 'Select at least one cocktail to continue.' },
  ] },
  { title: 'Rate Your Drinks', questions: [
    { key: 'ratings', q: 'Rate each cocktail you ordered.', kind: 'drinkRatings', required: true, rows: [
      { key: 'taste', label: 'Taste', kind: 'five', ends: ['Poor', 'Excellent'] },
      { key: 'again', label: 'Would you order it again?', kind: 'choice', options: AGAIN },
      { key: 'sat', label: 'Satisfaction', kind: 'five', ends: ['Very dissatisfied', 'Very satisfied'] },
    ] },
    { key: 'standout', q: 'What stood out about your drink(s), good or bad?', kind: 'text', placeholder: 'Tell us anything', required: true },
  ] },
  { title: 'The Menu', questions: [
    { key: 'menu', q: 'Rate the overall cocktail menu.', hint: '1 = Poor, 5 = Excellent', kind: 'matrix', rows: MENU_ROWS, required: true },
    { key: 'changes', q: 'What, if anything, would you add, change, or remove from the menu?', kind: 'text', placeholder: 'Your ideas', required: true },
    { key: 'service', q: 'Rate your experience with our bar team.', hint: '1 = Poor, 5 = Excellent', kind: 'matrix', rows: SERVICE_ROWS, required: true },
  ] },
  { title: 'Final Thoughts', questions: [
    { key: 'favorite', q: "What's your favorite drink, and which bar or restaurant makes it best?", kind: 'text', placeholder: 'The drink, and where', required: true, error: 'Please tell us your favorite drink to submit.' },
    { key: 'notes', q: "Anything else you'd like the team to know?", kind: 'text', placeholder: 'Optional' },
    { key: 'followup', q: 'May we follow up with you?', kind: 'choice', options: FOLLOWUP, required: true, error: 'Please choose an option to submit.' },
  ] },
];

const delayMin = () => { const n = parseInt(process.env.SURVEY_DELAY_MIN, 10); return Number.isNaN(n) ? 120 : Math.max(0, n); };

const five = (v) => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };
const text = (v) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, TEXT_MAX);
const pick = (v, options) => (options.includes(v) ? v : null);

// Validates what the page sends. Returns { answers } or { error, field }.
function clean(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'bad_answers' };
  const a = { drinks: {} };
  const rd = raw.drinks && typeof raw.drinks === 'object' ? raw.drinks : {};
  for (const name of COCKTAILS) {
    const d = rd[name]; if (!d || typeof d !== 'object') continue;
    const taste = five(d.taste), again = pick(d.again, AGAIN), sat = five(d.sat);
    if (!taste || !again || !sat) return { error: 'drink_incomplete', field: name };
    a.drinks[name] = { taste, again, sat };
  }
  if (!Object.keys(a.drinks).length) return { error: 'drinks_required', field: 'drinks' };
  a.standout = text(raw.standout); if (!a.standout) return { error: 'required', field: 'standout' };
  a.menu = {}; for (const k of Object.keys(MENU_ROWS)) { const v = five(raw.menu && raw.menu[k]); if (!v) return { error: 'required', field: 'menu' }; a.menu[k] = v; }
  a.changes = text(raw.changes); if (!a.changes) return { error: 'required', field: 'changes' };
  a.service = {}; for (const k of Object.keys(SERVICE_ROWS)) { const v = five(raw.service && raw.service[k]); if (!v) return { error: 'required', field: 'service' }; a.service[k] = v; }
  a.favorite = text(raw.favorite); if (!a.favorite) return { error: 'required', field: 'favorite' };
  a.notes = text(raw.notes);
  a.followup = pick(raw.followup, FOLLOWUP); if (!a.followup) return { error: 'required', field: 'followup' };
  return { answers: a };
}

// Tickets whose feedback email is due: redeemed long enough ago, we have an address, not sent yet.
const due = (t, now = Date.now()) => !!(t && t.redeemed && t.redeemedAt && t.email && !t.surveySentAt && now - t.redeemedAt >= delayMin() * 60000);

module.exports = { MENU, COCKTAILS, AGAIN, MENU_ROWS, SERVICE_ROWS, FOLLOWUP, STEPS, TEXT_MAX, delayMin, clean, due };
