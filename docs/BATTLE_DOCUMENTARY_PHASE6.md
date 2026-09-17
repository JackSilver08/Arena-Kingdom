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

## Current command

```text
npm run simulate:balance -- 4
```

The CI workflow runs the same four-repeat lab after static checks, type checking, tests, production build and bundle budget validation.

## Interpretation rule

Simulation output is evidence for tuning, not proof of a single universally correct strategy. A result can be driven by timing, scripted target selection, defensive reactions, building placement, or the underlying combat rules. Gameplay values should only be changed after repeated outputs point to a consistent imbalance.

## Current tuning loop

The economy system already uses soft army supply and maintenance. The next tuning pass should focus on the first point at which a rush becomes expensive enough to create a meaningful opportunity for infrastructure investment, while keeping early aggression possible.

Do not use the Influence Field as an economic modifier. It remains a presentation and battlefield-readability layer.
