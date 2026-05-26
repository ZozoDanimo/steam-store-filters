# Steam Store Filters — Millennium Plugin

A Millennium plugin for the Steam desktop client that adds a **"Store Filters"** entry in the left sidebar navigation, allowing you to search the entire Steam catalog by tags and sort results by **Wilson score** or **SteamDB rating**.

## Features

- **Tag-based search** — multi-select from ~90 curated Steam tags with autocomplete
- **Wilson score** — lower bound of the 95% confidence interval (Evan Miller, 2009)
- **SteamDB rating** — logarithmic confidence formula (SteamDB, 2017)
- **Paginated results** — 50 games per page, Steam Store capsule images
- **Score chips** — per-card score display (lazy-fetched to minimize API calls)
- **Native Steam UI** — fits Steam's dark theme, uses Steam's own components via `@steambrew/client`

## Score Formulas

### Wilson Score (Evan Miller)
```
score = (p̂ + z²/2n − z√((p̂(1−p̂) + z²/4n)/n)) / (1 + z²/n)
```
With `z = 1.96` (95% confidence), `p̂ = positive/total`, `n = total reviews`.

### SteamDB Rating
```
rating = score − (score − 0.5) × 2^(−log₁₀(n + 1))
```
Uncertainty halves every 10× increase in review count. Produces scores comparable to Steam's native percentage.

## Installation

### Prerequisites
- [Millennium](https://github.com/SteamClientHomebrew/Millennium) installed in your Steam client
- [pnpm](https://pnpm.io/) or Node.js

### Development Setup

```powershell
# In the project directory
pnpm install
pnpm run dev
```

Then place (or symlink) this folder into your Millennium plugins directory:

```powershell
# Windows — run as Administrator or with symlink permissions
$steamPath = (Get-ItemProperty 'HKLM:\SOFTWARE\Wow6432Node\Valve\Steam').InstallPath
New-Item -ItemType SymbolicLink -Path "$steamPath\plugins\steam-store-filters" -Target "C:\Steam filters ext"
```

Restart Steam, go to **Millennium Settings → Plugins**, enable **Steam Store Filters**, and restart once more.

## Attribution

- Inspired by [lorenzostanco.com/lab/steam/store/](https://www.lorenzostanco.com/lab/steam/store/) by Lorenzo Stanko
- Wilson score formula: Evan Miller — [How Not To Sort By Average Rating](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html) (2009)
- SteamDB rating: [steamdb.info/blog/steamdb-rating/](https://steamdb.info/blog/steamdb-rating/) (2017)
