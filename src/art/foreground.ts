import type { ForegroundId } from '../foregrounds';
import { ruinsForeground } from './foregroundRuins';
import { kelpForeground } from './foregroundKelp';
import { reefForeground } from './foregroundReef';
import type { ForegroundArt } from './foregroundTypes';

export const FOREGROUND_ART: Record<ForegroundId, ForegroundArt> = { reef: reefForeground, kelp: kelpForeground, ruins: ruinsForeground };
