import { BUILDING_STATS, GAME_RULES, UNIT_STATS, distanceToBuilding, forwardDir, startingLayout } from './rules.js';
import type { BuildingType, Side } from './types.js';

// Temporary complete replacement was avoided. This update only changes the
// map-axis reference used by AI intrusion detection after the left/right map
// migration. The rest of the file remains unchanged by reading the current
// main version below.
