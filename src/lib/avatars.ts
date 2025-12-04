// Avatar configuration and utilities

export const AVATAR_OPTIONS = [
  { id: 0, seed: 'felix', style: 'adventurer' },
  { id: 1, seed: 'luna', style: 'adventurer' },
  { id: 2, seed: 'max', style: 'adventurer' },
  { id: 3, seed: 'bella', style: 'adventurer' },
  { id: 4, seed: 'charlie', style: 'adventurer' },
  { id: 5, seed: 'mia', style: 'adventurer' },
  { id: 6, seed: 'leo', style: 'adventurer' },
  { id: 7, seed: 'nova', style: 'adventurer' },
  { id: 8, seed: 'oscar', style: 'adventurer' },
  { id: 9, seed: 'ruby', style: 'adventurer' },
  { id: 10, seed: 'theo', style: 'adventurer' },
  { id: 11, seed: 'ivy', style: 'adventurer' },
  { id: 12, seed: 'milo', style: 'adventurer' },
  { id: 13, seed: 'daisy', style: 'adventurer' },
  { id: 14, seed: 'finn', style: 'adventurer' },
  { id: 15, seed: 'coco', style: 'adventurer' },
  { id: 16, seed: 'archie', style: 'adventurer' },
  { id: 17, seed: 'willow', style: 'adventurer' },
  { id: 18, seed: 'jack', style: 'adventurer' },
  { id: 19, seed: 'penny', style: 'adventurer' },
];

export function getAvatarUrl(seed: string, style: string = 'adventurer') {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
}

export function getAvatarById(avatarId: number) {
  return AVATAR_OPTIONS[avatarId] || AVATAR_OPTIONS[0];
}

