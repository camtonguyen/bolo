/**
 * Fictional cast. The player only ever edits these — never an arbitrary
 * uploaded photo of a real person.
 *
 * Portraits are original illustrated PNGs (public/character-casts/), not
 * photographs.
 */
export const SUSPECTS = {
  'DR-4417': {
    name: 'Nadia Voss',
    alias: 'Blackout',
    charge: 'Grand larceny, 3 counts',
    bounty: 45_000,
    portrait: '/character-casts/6.png',
    portraitSize: { w: 314, h: 386 },
    lastSeen: 'Port Verona, Dock 9',
    intakeDate: '2026-06-02',
  },
  'DR-4419': {
    name: 'Dragan Kovic',
    alias: 'Anvil',
    charge: 'Aggravated assault, 4 counts — racketeering',
    bounty: 78_000,
    portrait: '/character-casts/4.png',
    portraitSize: { w: 322, h: 377 },
    lastSeen: 'Calder Heights',
    intakeDate: '2026-07-18',
  },
  'DR-4423': {
    name: 'Cody Pruitt',
    alias: 'Sparky',
    charge: 'Arson, 2 counts — criminal mischief',
    bounty: 32_000,
    portrait: '/character-casts/3.png',
    portraitSize: { w: 306, h: 383 },
    lastSeen: 'Sunfall Strip',
    intakeDate: '2026-08-09',
  },
  'DR-4425': {
    name: 'Vivian Ashcroft',
    alias: 'The Duchess',
    charge: 'Smuggling, 5 counts — customs fraud',
    bounty: 56_000,
    portrait: '/character-casts/2.png',
    portraitSize: { w: 295, h: 407 },
    lastSeen: 'Port Verona, Container Yard 4',
    intakeDate: '2026-06-20',
  },
  'DR-4428': {
    name: 'Milo Bregman',
    alias: 'Glitch',
    charge: 'Computer fraud, 6 counts — identity theft',
    bounty: 61_000,
    portrait: '/character-casts/9.png',
    portraitSize: { w: 298, h: 402 },
    lastSeen: 'Calder Heights, Server Row',
    intakeDate: '2026-07-05',
  },
  'DR-4432': {
    name: 'Dolores Higgins',
    alias: 'Sweet Tooth',
    charge: 'Auto theft, 4 counts — evading arrest',
    bounty: 39_500,
    portrait: '/character-casts/8.png',
    portraitSize: { w: 317, h: 398 },
    lastSeen: 'Sunfall Strip, Overpass 12',
    intakeDate: '2026-07-29',
  },
  'DR-4436': {
    name: 'Vera Lindqvist',
    alias: 'Paper Trail',
    charge: 'Forgery, 7 counts — counterfeiting',
    bounty: 48_000,
    portrait: '/character-casts/11.png',
    portraitSize: { w: 299, h: 406 },
    lastSeen: 'Port Verona, Financial Row',
    intakeDate: '2026-08-14',
  },
  'DR-4440': {
    name: 'Marcus Delroy',
    alias: 'Goldmouth',
    charge: 'Extortion, 3 counts — criminal conspiracy',
    bounty: 82_000,
    portrait: '/character-casts/12.png',
    portraitSize: { w: 318, h: 411 },
    lastSeen: 'Calder Heights, Depot 7',
    intakeDate: '2026-08-27',
  },
  'DR-4443': {
    name: 'Rusty Callahan',
    alias: 'Ashtray',
    charge: 'Petty theft, 2 counts — resisting arrest',
    bounty: 21_000,
    portrait: '/character-casts/1.png',
    portraitSize: { w: 318, h: 420 },
    lastSeen: 'Sunfall Strip, Motel Row',
    intakeDate: '2026-06-11',
  },
  'DR-4447': {
    name: 'Walter Kessler',
    alias: 'The Ledger',
    charge: 'Embezzlement, 3 counts — tax fraud',
    bounty: 67_000,
    portrait: '/character-casts/5.png',
    portraitSize: { w: 294, h: 404 },
    lastSeen: 'Port Verona, Financial Row',
    intakeDate: '2026-07-22',
  },
  'DR-4451': {
    name: 'Ezra Doyle',
    alias: 'Tumbleweed',
    charge: 'Breaking and entering, 3 counts — trespassing',
    bounty: 28_500,
    portrait: '/character-casts/10.png',
    portraitSize: { w: 319, h: 408 },
    lastSeen: 'Calder Heights, Rail Yard',
    intakeDate: '2026-08-03',
  },
  /** Act two. Seeded into the queue after CASES_BEFORE_REVEAL closures. */
  'DR-0001': {
    name: '[OPERATOR RECORD]',
    alias: '—',
    charge: 'Unauthorised system access',
    bounty: 250_000,
    portrait: '/character-casts/7.png',
    portraitSize: { w: 318, h: 407 },
    lastSeen: 'This terminal',
    intakeDate: '2026-09-01',
  },
} as const;

export type SuspectId = keyof typeof SUSPECTS;
export type Suspect = (typeof SUSPECTS)[SuspectId];

const SUSPECT_IDS = Object.keys(SUSPECTS) as readonly SuspectId[];

/** Validates an untrusted value against the actual cast — the persistence read boundary needs this since a saved record could predate a cast change. */
export function isSuspectId(value: unknown): value is SuspectId {
  return typeof value === 'string' && (SUSPECT_IDS as readonly string[]).includes(value);
}

export const CASES_BEFORE_REVEAL = 3;

export const OPERATOR_RECORD_ID = 'DR-0001' satisfies SuspectId;

/** In-world scale flavor: the department's total index, not the cast size. Referenced by boot + queue. */
export const TOTAL_RECORDS_INDEXED = 41_208;

/** Every case in this cast is filed under the same force. Referenced by the record view's metadata block. */
export const JURISDICTION = 'LEONIDA STATE POLICE — WANTED DIV.';
