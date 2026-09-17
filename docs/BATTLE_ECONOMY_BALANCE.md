# Battle Economy & Anti-Rush Balance

## Goal

The economy should be a strategic path, not a cosmetic side system. A player can still open with a military rush, but maintaining a large standing army should require a functioning kingdom.

## Supply model

Army supply is a **soft capacity**, not a hard unit cap.

| Building | Supply | Existing role |
| --- | ---: | --- |
| Castle | +6 | Core of the kingdom |
| Barracks | +3 | Training and military infrastructure |
| Village | +1 | Economy and logistics |
| Tower | +2 | Defensive infrastructure |
| Fence | +0 | Defensive barrier |

The current starting kingdom therefore has **12 supply** before recruiting additional troops: 6 from the Castle, 3 from the starting Barracks, and 1 from each of the three starting Villages.

## Upkeep

Every 5 seconds, troops above supply capacity consume:

`ceil((Army - Supply) × 1.0)` gold

Upkeep is paid after gross income is added. Gold cannot fall below zero. When the treasury is empty, the unpaid portion is not converted into debt.

Examples with 12 supply:

| Army | Over capacity | Upkeep / 5s |
| ---: | ---: | ---: |
| 3 | 0 | $0 |
| 12 | 0 | $0 |
| 15 | 3 | $3 |
| 16 | 4 | $4 |
| 18 | 6 | $6 |
| 28 | 16 | $16 |
| 40 | 28 | $28 |

## Strategic loop

`Economy → Military → Territory → Economy`

Villages have two connected benefits: they add recurring gold income and expand the army's logistics capacity by one. Barracks add training throughput and three supply each. Towers add a smaller supply reserve while strengthening the defensive layer.

The system does **not** use the influence overlay to change economic values. Influence remains a visual/readability layer, preserving its separation from gameplay balance.

## Player feedback

The battle HUD exposes `army / supply` and the current upkeep rate. The Troops panel also explains that villages and barracks expand logistics, so the maintenance rule is visible rather than hidden.

## Phase 6 tuning evidence

The first four-repeat balance lab was completed on 24 scripted matches before this tuning pass. The rush profile reached its first attack at about 58s and recorded 3/4 wins against Economy, 4/4 against Defensive, and 4/4 against Balanced. Its peak supply was 28 while peak upkeep was effectively zero in those matchups, showing that the original 22-starting-supply model often allowed a decisive rush without paying maintenance.

That observation led to a deliberately moderate supply tightening: the starting capacity falls from 22 to 12, a second Barracks raises it to 15, and upkeep begins immediately above that point at one gold per excess troop per income interval. Early aggression is still possible, but the simulation now has a visible economic pressure point around normal rush army sizes.

## Balance intent

- Early aggression remains possible.
- Large armies become progressively more expensive to sustain.
- Village investment becomes useful for both gold generation and army logistics.
- Losing a barracks, village, or tower can reduce supply immediately, creating a real infrastructure risk.
- The hard unit limit remains 40, while supply determines the economic pressure before that ceiling.

## Next test pass

Run the four-repeat lab again after the tuning change:

```text
npm run simulate:balance -- 4
```

Compare first attack timing, first over-supply, peak upkeep, final gold, infrastructure count, and match duration against the baseline. The next change should be driven by repeated output rather than a single matchup result.
