export interface SteamPlatform {
  os: string;
  label: string;
}

export interface SteamFeature {
  category: number;
  label: string;
}

export interface SteamAccessibility {
  id: number;
  label: string;
}

export const STEAM_PLATFORMS: SteamPlatform[] = [
  { os: 'win', label: 'Windows' },
  { os: 'mac', label: 'Mac' },
  { os: 'linux', label: 'Linux/SteamOS' },
  { os: 'deck', label: 'Steam Deck' },
];

export const STEAM_FEATURES: SteamFeature[] = [
  { category: 22, label: 'Achievements' },
  { category: 57, label: 'Captions available' },
  { category: 23, label: 'Cloud' },
  { category: 9, label: 'Co-op (any)' },
  { category: 28, label: 'Controller support (any)' },
  { category: 27, label: 'Cross-Platform Multiplayer' },
  { category: 74, label: 'Demo available' },
  { category: 21, label: 'Downloadable Content' },
  { category: 493, label: 'Early access' },
  { category: 62, label: 'Family Sharing' },
  { category: 28, label: 'Full Controller Support' },
  { category: 101, label: 'GeForce NOW' },
  { category: 401, label: 'HDR available' },
  { category: 35, label: 'In-App Purchases' },
  { category: 17, label: 'Includes level editor' },
  { category: 63, label: 'Input API' },
  { category: 64, label: 'Is learning about this game' },
  { category: 37, label: 'LAN Co-op' },
  { category: 36, label: 'LAN PvP' },
  { category: 25, label: 'Leaderboards' },
  { category: 1, label: 'MMO' },
  { category: 38, label: 'Multiplayer (any)' },
  { category: 36, label: 'Online Co-op' },
  { category: 36, label: 'Online PvP' },
  { category: 59, label: 'PS4 Controllers' },
  { category: 60, label: 'PS5 Controllers' },
  { category: 18, label: 'Partial Controller Support' },
  { category: 26, label: 'Profile Features Limited' },
  { category: 150, label: 'Remote Play (any)' },
  { category: 44, label: 'Remote Play Together' },
  { category: 41, label: 'Remote Play on Phone' },
  { category: 43, label: 'Remote Play on TV' },
  { category: 42, label: 'Remote Play on Tablet' },
  { category: 39, label: 'Shared/Split Screen Co-op' },
  { category: 37, label: 'Shared/Split Screen PvP' },
  { category: 2, label: 'Single-player' },
  { category: 15, label: 'Stats' },
  { category: 55, label: 'Tracked Controller Support' },
  { category: 29, label: 'Trading Cards' },
  { category: 401, label: 'WSGF: 4k UHD' },
  { category: 402, label: 'WSGF: Multi-monitor' },
  { category: 404, label: 'WSGF: Ultra-Wide' },
  { category: 403, label: 'WSGF: Widescreen' },
  { category: 30, label: 'Workshop' },
];

export const STEAM_VR: SteamFeature[] = [
  { category: 29, label: 'VR (any)' },
  { category: 104, label: 'VR Supported' },
];

export const STEAM_ACCESSIBILITY: SteamAccessibility[] = [
  { id: 1, label: 'Adjustable Difficulty' },
  { id: 2, label: 'Adjustable Text Size' },
  { id: 3, label: 'Camera Comfort' },
  { id: 4, label: 'Color Alternatives' },
  { id: 5, label: 'Contrast Controls' },
  { id: 6, label: 'Custom Volume Controls' },
  { id: 7, label: 'Keyboard Only Option' },
  { id: 8, label: 'Mouse Only Option' },
  { id: 9, label: 'Narrated Game Menus' },
  { id: 10, label: 'Playable at Your Own Pace' },
  { id: 11, label: 'Playable without Quick Time Events' },
  { id: 12, label: 'Save Anytime' },
  { id: 13, label: 'Stereo Sound' },
  { id: 14, label: 'Subtitle Options' },
  { id: 15, label: 'Surround Sound' },
  { id: 16, label: 'Touch Only Option' },
];
