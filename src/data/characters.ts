import type { EmberTint } from '../utils/atmosphere';

export interface CharacterProfile {
  id: string;
  name: string;
  alias: string;
  faction: 'Latveria' | 'Fantastic Four' | 'Avengers' | 'Asgard';
  role: string;
  realm: string;
  weapon: string;
  quote: string;
  dossier: string;
  threatLevel: string;
  imageUrl: string;
  imageSrcSet?: string;
  imageSizes?: string;
  imageScaleClass?: string;
  accentHex: string;
  emberTint: EmberTint;
  isCutout?: boolean;
}

export const DOCTOR_DOOM: CharacterProfile = {
  id: 'doctor-doom',
  name: 'Doctor Doom',
  alias: 'Victor Von Doom',
  faction: 'Latveria',
  role: 'Sovereign of Latveria',
  realm: 'Latveria · Battleworld',
  weapon: 'Arcane Sorcery & Titanium Armor',
  quote: 'All realities fracture. Only Doom endures.',
  dossier:
    'Armed with peerless intellect and forbidden mystic arts, Victor Von Doom steps out of the collapsing multiverse to impose absolute order over the ashes of broken timelines.',
  threatLevel: 'OMEGA-CLASS SOVEREIGN',
  imageUrl: '/assets/aistudio/doctor-doom-smoke-1600.webp',
  imageSrcSet:
    '/assets/aistudio/doctor-doom-smoke-960.webp 960w, /assets/aistudio/doctor-doom-smoke-1600.webp 1600w',
  imageSizes: '(max-width: 1023px) 164vw, 112vw',
  imageScaleClass: 'scale-[1.12]',
  accentHex: '#22C55E',
  emberTint: 'emerald',
  isCutout: true,
};

export const CHARACTERS: CharacterProfile[] = [
  DOCTOR_DOOM,
  {
    id: 'scarlet-nexus',
    name: 'Thor Odinson',
    alias: 'God of Thunder',
    faction: 'Asgard',
    role: 'Protector of the Nine Realms',
    realm: 'New Asgard · Yggdrasil',
    weapon: 'Stormbreaker & Mjolnir',
    quote: 'Even the roots of Yggdrasil tremble before this shadow.',
    dossier:
      'Summoned from the edge of the cosmos as Loki’s multiversal branches begin to wither, Thor brings the full fury of the Bifrost into the Battleworld storm.',
    threatLevel: 'COSMIC DEITY',
    imageUrl: '/assets/aistudio/thor-odinson-1024.webp',
    imageSrcSet:
      '/assets/aistudio/thor-odinson-640.webp 640w, /assets/aistudio/thor-odinson-1024.webp 1024w',
    imageSizes: '(max-width: 1023px) 164vw, 112vw',
    imageScaleClass: 'scale-[1.12]',
    accentHex: '#FACC15',
    emberTint: 'electric-yellow',
    isCutout: true,
  },
  {
    id: 'captain-america',
    name: 'Captain America',
    alias: 'Sentinel of Liberty',
    faction: 'Avengers',
    role: 'Field Commander, Avengers',
    realm: 'Earth-616 · New Avengers Compound',
    weapon: 'Vibranium Shield & Exo-7 Flight Suit',
    quote: 'When worlds collide, we don’t trade lives—we hold the line.',
    dossier:
      'Tasked with uniting a fractured roster of heroes across realities, Captain America leads Earth-616’s first response against the Latverian sovereign’s incursion.',
    threatLevel: 'TACTICAL VANGUARD',
    imageUrl: '/assets/aistudio/captain-america-1024.webp',
    imageSrcSet:
      '/assets/aistudio/captain-america-640.webp 640w, /assets/aistudio/captain-america-1024.webp 695w',
    imageSizes: '(max-width: 1023px) 164vw, 112vw',
    imageScaleClass: 'scale-[1.12]',
    accentHex: '#A3E635',
    emberTint: 'chartreuse',
    isCutout: true,
  },
  {
    id: 'mister-fantastic',
    name: 'Mister Fantastic',
    alias: 'Reed Richards',
    faction: 'Fantastic Four',
    role: 'Architect of the Life Raft',
    realm: 'Earth-828 · Baxter Building',
    weapon: 'Hyper-Elasticity & Multiversal Bridge',
    quote: 'Every equation has a variable we missed. Victor is that variable.',
    dossier:
      'Crossing the dimensional barrier after witnessing his own universe unravel, Reed Richards races against the final incursion to decipher Doom’s Battleworld blueprint.',
    threatLevel: 'STRATEGIC GENIUS',
    imageUrl: '/assets/aistudio/mister-fantastic-1024.webp',
    imageScaleClass: 'scale-[1.93] translate-y-[27%]',
    accentHex: '#38BDF8',
    emberTint: 'cyan-emerald',
    isCutout: true,
  },
];
