# Arena Kingdom v0.2 Gameplay

All numbers live in [`shared/src/rules.ts`](../shared/src/rules.ts); the in-game guide (`/guide`) is generated from the same file.

## Match goal

Destroy the opponent's **Castle**. Blue starts on the left, Red on the right.

A match also ends when:

- a player **surrenders** (messenger `M`, or leaving an online match);
- both rulers agree to a **peace treaty** (draw);
- an online player stays **disconnected** for longer than the reconnection window (30s by default);
- **20 minutes** pass — the castle with more remaining health wins, equal health is a draw.

## Economy

- Start with 150 gold, a castle, 2 villages, a barracks and 4 soldiers.
- Every 5 seconds the castle pays +4 gold and each village +5 gold.

## Buildings

Buildings can only be placed in your own territory, outside the contested centre strip, and not overlapping other buildings.

| Building | Cost | HP   | Notes                                                   |
| -------- | ---- | ---- | ------------------------------------------------------- |
| Castle   | —    | 1600 | Shoots nearby enemy soldiers (9 dmg/s). Losing it loses the match. |
| Village  | 75   | 350  | +5 gold per income tick                                  |
| Barracks | 120  | 550  | Trains soldiers; queue up to 5; barracks train in parallel |
| Tower    | 130  | 800  | Shoots enemy soldiers (20 dmg every 0.8s)                |

## Units

| Unit | Cost | Train time | HP | Speed | Attack | Range | Role |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Soldier | 18 | 2.2s | 100 | 52 | 12 / 0.8s | 14 | Basic melee infantry |
| Archer | 21 | 2.6s | 75 | 45 | 9 / 1.1s | 190 | Long-range harassment; 125 range against buildings |
| Knight | 24 | 2.5s | 150 | 156 | 17 / 0.9s | 18 | Fast cavalry; 3× base Soldier speed |

Barracks train one unit type per active queue. Multiple barracks can train different unit types in parallel.

Soldiers and Knights automatically engage enemies within their aggro range. Archers prefer enemy troops at long range and can also damage buildings from a shorter dedicated range.

Attack-move orders fight along the way; plain move orders (Shift + right-click) ignore enemies — use them to retreat.

Archer shots use a visible rising-and-falling arrow projectile before the impact effect.

## Controls

| Input                    | Action                                                    |
| ------------------------ | --------------------------------------------------------- |
| Left-drag / click        | Select soldiers (Shift adds / toggles)                    |
| Right-click              | Attack-move selected soldiers                             |
| Shift + right-click      | Move without fighting                                     |
| `A` / `S`                | Select whole army / hold position                         |
| `B`, then `1` `2` `3`    | Build Village / Barracks / Tower, click to place (Shift keeps building) |
| `R` / Shift + `R`        | Recruit 1 / 5 soldiers at the least busy barracks         |
| Click your barracks      | Recruit a soldier there                                   |
| `T`, then `1` `2` `3`    | Send All / ⅓ / ⅔ of the army to a clicked point           |
| `M`                      | Messenger: propose peace, surrender                       |
| `Esc`                    | Cancel the current order or clear the selection           |

## Diplomacy

A peace proposal gives the opponent 15 seconds to answer. Proposals have a 30-second cooldown. AI commanders only accept when they are losing.

## Modes

- **vs AI** — runs entirely in the browser. Signed-in players get the result saved to their match history (ratings are not affected).
- **Ranked 1v1** — matchmaking between signed-in players; Elo rating (K = 32, everyone starts at 1000).
- **Private room** — share the room code with a friend; saved to history, ratings unchanged.

## AI commanders

| Commander | Style                                                                 |
| --------- | --------------------------------------------------------------------- |
| Squire    | 3 villages, one barracks, army capped at 18, first attack around 2:30 |
| Knight    | 5 villages, two barracks, a tower, waves from ~1:50 when not outnumbered |
| Warlord   | 6 villages, three barracks, two towers, adaptive early attacks, reinforcements and retreats |

`npm run simulate -- hard normal 20` pits the AIs against each other for balancing.

## Design principles

1. The visual layer is replaceable. Emoji and generated shapes are presentation, not game data.
2. The server is the authority for online matches; the same engine runs offline matches in the browser.
3. Keep the playable build small before adding more unit types or resources.
