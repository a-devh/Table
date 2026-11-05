# Table

A deckbuilding simulator for Magic: The Gathering.

- `app/` – the app: React + TypeScript + PixiJS, with a Tauri (Rust) desktop shell in `app/src-tauri/`.
- `docs/` – requirements and design.

## Run

```
cd app
npm install
npm run tauri dev   # desktop app
npm run dev         # in a browser
```

## Web version

Every push to `main` builds the browser version and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). In the browser, search goes straight to Scryfall,
saves use the browser's file picker, and favorites, collection and settings are
kept per browser.

Card data and images come from [Scryfall](https://scryfall.com). Table is unofficial
Fan Content; Magic: The Gathering is © Wizards of the Coast.
