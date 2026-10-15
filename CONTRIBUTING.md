# Contributing

Thanks for wanting to help improve the FarmRPG Quest Tracker! This
is a fan project — not affiliated with FarmRPG, and it will never be
monetized. There are a few ways to contribute, depending on how comfortable
you are with git.

## Contributing code

Bug fixes, UI improvements, and small features are welcome as pull requests.
Bigger changes (new pages, new calculation behavior, anything touching how
quest/item data is fetched or cached) are best discussed in an issue first
so we don't end up with wasted work.

### Local setup

```
npm install
npm run dev
```

The app fetches `questlines.json`/`items.json`/`npc.json`/`locations.json`/`item-sources.json`
from `static/` at runtime rather than bundling them, and those master databases are gitignored
and kept locally by the maintainer — so a fresh clone won't have them. `npm run dev`
and `npm run test` both run a `predev`/`pretest` step (`npm run seed-data`)
that copies committed `static/*.sample.json` fixtures into `static/*.json` if those files don't
already exist. The sample data is synthetic (mock quest, item, and location names)
— just enough shape to exercise the app and calculation logic locally. It
never overwrites real data: if real files already exist in `static/`, the seed step is a no-op.

### Before opening a PR

```
npm run lint     # prettier + eslint
npm run check    # svelte-check
npm run test     # unit tests (vitest) + e2e (playwright)
```

All three should pass. `npm run format` will fix most lint issues
automatically.

### What's out of scope for a PR

- Anything in `static/*.json` — the master database is maintained incrementally by the
  project author and is not committed to git. Use the in-app **Feedback / report an issue**
  button or message `kodyy` in-game to report incorrect or missing quest data instead of opening
  a PR.
- Monetization, commercial features, or invasive tracking — this project will never ship those.
