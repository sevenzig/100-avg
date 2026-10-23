# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The existing Wingspan play group. After a game, members log the result and check who is averaging 100 points.

## Product Purpose

Wingspan Score Tracker shows which members of the play group actually average 100 points per game. That average is why the group built the tracker, and why the project is named 100-avg. Success is a true season average and a true career average for each member.

## Positioning

The group’s own 100-point target, scored from real games and split into a live season average and a live career average. The tracker answers who in this group is actually averaging 100.

## Operating Context

Members play Wingspan together, then log the game while the score sheet is still in hand. They type the scores or upload a screenshot of the digital score sheet. The app matches a player by username or by a Steam, Android, or iPhone alias. The group uses it in a browser, behind accounts. Production is at 100avg.phelddagrif.farm.

## Capabilities and Constraints

- Accounts and invite codes. A league is visible only to its members.
- A game records up to five players, with placement and a scoring breakdown: birds, bonus cards, end-of-round goals, eggs, food on cards, tucked cards, and nectar.
- Games are entered by hand or from a digital score-sheet screenshot. Manual entry stays available.
- Seasons use one app-wide clock of two-month UTC pairs: Dec–Jan, Feb–Mar, Apr–May, Jun–Jul, Aug–Sep, Oct–Nov. Ended seasons stay in place. Averages are computed live, as a career average and a season average. v1 has no trophies, season names, or season editor.
- The scoreboard’s recent games are the three most recently played matches in the selected season. The all-games list stays in upload order.
- Players see the name Wingspan Score Tracker. 100-avg is the project name and the domain name.
- The app is SvelteKit 2 and Svelte 5, with SQLite, JWT in an httpOnly cookie, and Tailwind with DaisyUI. Production is one Docker container.

## Brand Commitments

The player-facing name is Wingspan Score Tracker. 100-avg is the project name, the domain name, and the group’s target scoring average per game.

## Evidence on Hand

The running app and its SQLite history are the record. Season rules live in `docs/development/SEASONS_PRD.md`. There are no testimonials, press mentions, or marketing claims to reuse. The root `README.md` is an older design note and still describes three-player leagues.

## Product Principles

- Answer who in the group averages 100, this season and across a career.
- Log the game from the score sheet, by screenshot or by hand.
- Keep history. Seasons archive in place, and averages stay live.
- Keep each league private to its members.
