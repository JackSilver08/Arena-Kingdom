# Battle Economy & Anti-Rush Balance

## Goal

The economy should be a strategic path, not a cosmetic side system. A player can still open with a military rush, but maintaining a large standing army should require a functioning kingdom.

## Supply model

Army supply is a **soft capacity**, not a hard unit cap.

| Building | Supply | Existing role |
| --- | ---: | --- |
| Castle | +10 | Core of the kingdom |
| Barracks | +6 | Training and military infrastructure |
| Village | +2 | Economy and logistics |
| Tower | +2 | Defensive infrastructure |
| Fence | +0 | Defensive barrier |

The current starting kingdom therefore has 22 supply before recruiting additional troops.

## Upkeep

Every 5 seconds, troops above supply capacity consume:

`ceil((Army - Supply) × 0.75)` gold

Upkeep is paid after gross income is added. Gold cannot fall below zero. When the treasury is empty, the unpaid portion is not converted into debt.

Examples with 22 supply:

| Army | Over capacity | Upkeep / 5s |
| ---: | ---: | ---: |
| 3 | 0 | 0$ |
| 22 | 0 | 0$ |
| 28 | 6 | 5$ |
| 30 | 8 | 6$ |
| 40 | 18 | 14$ |

## Strategic loop

`Economy → Military → Territory → Economy`

Villages now have two connected benefits: they add recurring gold income and expand the army a little. Barracks add training throughput and a larger supply footprint. Towers also provide a small logistics reserve while strengthening the defensive layer.

The system does **not** use the influence overlay to change economic values. Influence remains a visual/readability layer, preserving its separation from gameplay balance.

## Player feedback

The battle HUD now exposes `army / supply` and the current upkeep rate. The Troops panel also explains that villages and barracks expand logistics, so the maintenance rule is visible rather than hidden.

## Balance intent

- Early aggression remains possible.
- Large armies become progressively more expensive to sustain.
- Village investment becomes useful for both gold generation and army logistics.
- Losing a barracks, village, or tower can reduce supply immediately, creating a real infrastructure risk.
- The hard unit limit remains 40, while supply determines the economic pressure before that ceiling.

## Next test pass

Balance should be validated with repeated scripted simulations of at least four archetypes:

1. Rush: Barracks → troops → immediate attack
2. Economy: Village → Village → Village → Barracks → army
3. Defensive: Village + Tower + Fence → hold territory → army
4. Balanced: Village → Barracks → Village → Army → Tower

Track gold, army size, supply, upkeep, castle HP and match duration. The target is not to remove rush play, but to make long-lived military pressure depend on infrastructure rather than recruitment spam alone.
