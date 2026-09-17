# Battle Documentary Phase 6: Balance Simulation

## Objective

Validate the kingdom economy with repeatable scripted matchups before changing gameplay numbers further. The simulation lab is a measurement tool only. It does not mutate rules or rank player strategies outside the reported match metrics.

## Strategy archetypes

Four macro profiles are represented:

1. **Rush**: early Barracks investment, rapid troop production, first attack around 45s, V-Wedge formation.
2. **Economy**: multiple Villages first, then Barracks and Tower infrastructure, later attack around 90s.
3. **Defensive**: Villages plus Towers and Fence segments, later Barracks, delayed attack around 110s, Square formation.
4. **Balanced**: alternating Villages, Barracks, defensive infrastructure, attack around 80s, Line formation.

Each matchup runs the two profiles in opposite colours across repeats so a fixed left/right map advantage is easier to detect.

## Recorded metrics

For the profiled side the lab records:

- result and end reason
- match duration
- peak army size
- peak supply
- peak upkeep per income interval
- final gold
- final Villages, Barracks, Towers and Fences
- first offensive order time
- first time the army exceeded supply

The lab also checks that gold remains finite and never drops below zero.

## Baseline result

The first four-repeat lab completed **24 scripted matches**. In the baseline economy model, the Rush profile reached its first attack at about 58s and recorded:

| Matchup | Rush-side result |
| --- | ---: |
| Rush vs Economy | 3/4 wins |
| Rush vs Defensive | 4/4 wins |
| Rush vs Balanced | 4/4 wins |

Across those rush matchups, peak supply averaged 28 and peak upkeep was 0.0 except for a small 0.3 average in Rush vs Economy. The Rush build order was therefore often reaching a decisive troop mass while remaining inside or barely touching its large supply allowance.

This is simulation evidence for a tuning change, not proof that Rush is universally optimal. The result can still depend on scripted build timing, target selection, building placement, defensive response and combat rules.

## Phase 6 tuning pass

The first tuning pass tightens logistics without making troop production a hard-cap system:

| Rule | Baseline | Phase 6 tuned |
| --- | ---: | ---: |
| Castle supply | +10 | +6 |
| Barracks supply | +6 | +3 |
| Village supply | +2 | +1 |
| Tower supply | +2 | +2 |
| Upkeep rate | 0.75 gold / excess troop | 1.0 gold / excess troop |
| Starting supply | 22 | 12 |

With the tuned model, the opening army remains maintenance-free, a second Barracks takes the kingdom to 15 supply, and a 16-troop standing army produces 4 gold of upkeep every 5 seconds.

The intended effect is a clearer economic decision point: early aggression stays available, but sustained troop spam begins consuming treasury before the army reaches the hard 40-unit ceiling.

## Current command

```text
npm run simulate:balance -- 4
```

The CI workflow runs the same four-repeat lab after static checks, type checking, tests, production build and bundle budget validation.

## Interpretation rule

Simulation output is evidence for tuning, not proof of a single universally correct strategy. A result can be driven by timing, scripted target selection, defensive reactions, building placement, or the underlying combat rules. Gameplay values should only be changed after repeated outputs point to a consistent imbalance.

## Tuning loop

1. Establish a 4-repeat baseline.
2. Change one balance lever at a time.
3. Run the same 24-match matrix.
4. Compare army, supply, upkeep, gold, infrastructure, first attack and duration.
5. Keep the change only when the repeated output shows a healthier tradeoff between aggression and infrastructure.

Do not use the Influence Field as an economic modifier. It remains a presentation and battlefield-readability layer.
