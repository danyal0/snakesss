const ADJECTIVES = [
  'Sly', 'Swift', 'Clever', 'Bold', 'Quiet', 'Lucky', 'Brave', 'Witty',
  'Cosmic', 'Neon', 'Shadow', 'Golden', 'Wild', 'Chill', 'Fuzzy', 'Zesty',
];

const ANIMALS = [
  'Fox', 'Wolf', 'Hawk', 'Bear', 'Owl', 'Lynx', 'Panda', 'Tiger',
  'Viper', 'Raven', 'Otter', 'Badger', 'Cobra', 'Gecko', 'Mongoose', 'Falcon',
];

export function generateRandomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]!;
  const n = Math.floor(Math.random() * 90) + 10;
  return `${adj}${animal}${n}`;
}
