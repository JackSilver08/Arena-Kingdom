# Battle Economy & Anti-Rush Balance

## Goal

The economy should be a strategic path, not a cosmetic side system. A player can still open with a military rush, but a large standing army should create a visible treasury tradeoff. Normal matches should also build momentum quickly enough that players are not trapped in long economic setup phases.

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

## Faster economic tempo

The next tuning pass improves early liquidity and infrastructure payback without changing the 12-supply anti-spam anchor:

| Rule | Previous | Current tuning |
| --- | ---: | ---: |
| Starting gold | 100 | **110** |
| Castle income | 4 / 5s | **5 / 5s** |
| Village income | 5 / 5s | **6 / 5s** |
| Village cost | 75 | **70** |
| Barracks cost | 120 | **110** |
| Tower cost | 130 | **120** |
| Fence cost | 30 | **25** |
| Troop cost | 20 | **18** |
| Troop train time | 2500ms | **2200ms** |

A Village now pays back its construction cost through its incremental income in about 12 income cycles, or roughly 58 seconds, before considering its supply value. That makes economic investment relevant inside a several-minute match rather than a long setup period.

## Strategic loop

`Economy → Military → Territory → Economy`

Villages provide recurring gold and a small logistics increase. Barracks improve training throughput and supply. Towers are cheaper to make defensive infrastructure available earlier. Troops are slightly cheaper and faster to recruit so the battlefield becomes active quickly.

The anti-rush constraint remains the same: once an army grows beyond its supply, every additional standing troop consumes treasury on each 5-second maintenance tick. The hard unit limit remains 40, so supply creates economic pressure well before the absolute ceiling.

The system does **not** use the influence overlay to change economic values. Influence remains a visual/readability layer, preserving its separation from gameplay balance.

## Intended match rhythm

- Opening: players can invest in troops immediately and reach the battlefield quickly.
- Early clash: Rush can create meaningful pressure before a passive economy snowballs.
- Mid game: Village investment accelerates income while supply and upkeep constrain uncontrolled troop spam.
- Resolution: a prolonged army requires infrastructure rather than recruitment alone.
- Long stalemates remain possible when both sides defend well, but the default economic tempo is designed around a few-minute clash rather than a long setup period.

## Balance checkpoint

Phase 6 established the anti-rush supply/upkeep model and validated it through the completed 24-match scripted balance lab. The next work is gameplay tuning and feel, not expansion of the QA matrix.

For further tuning, change the smallest number of economic levers necessary. Keep supply/upkeep as the anti-spam backbone and adjust income, infrastructure costs, and troop throughput around the desired match tempo.
