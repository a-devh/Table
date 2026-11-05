# Table: Requirements

Status: phase 1 (requirements), agreed in discussion on 2026-10-31.

Mockups: https://claude.ai/artifact/G1edJu9eNNgXT9amvDrCmU (dark and light modes, accent options).

## Vision

A deckbuilder for Magic: The Gathering that simulates building a deck physically. Instead of click-to-add lists, cards are physical objects on a free-form table: you drag them in from search, move them, stack them, and sort them the way you would at a real table. The goal is frictionless, open deck creation. The primary user is the author.

## Platform and look

- Desktop app built with **Tauri + React**, chosen for low memory use.
- Dark and light modes, each with a choice of accent color.

## Layout

- Left sidebar with pop-out panels: **Search**, **Favorites**, **Collection**.
- **Settings** and **Exit** at the bottom of the sidebar.
- The **table** fills the rest of the window.
- **Screen UI vs. table objects:** anything that doesn't move when you pan is a floating bubble attached flush to a screen edge (flat on the edge side, rounded elsewhere), not a full-length bar. Fences, cards, and their analytics live on the table and move with it.
- Bubbles attached to the bottom edge, centered as a group with equal spacing: Hand/Pencil tools; the deck name (click to type a new one), format, **New**, **Open**, **Save**, **Export**; zoom controls.
- The **tag tray** lives in the top-right corner. Closed, it is a small tab labeled **#**; click it to expand the tray.

## The table

### An infinite table
- The table is an infinite canvas you pan and zoom, like the Windows Whiteboard app.
- Everything is flat 2D. "Physical" describes how cards behave, not 3D rendering.

### Controls
Mirror existing whiteboard tools (Figma, Miro, Windows Whiteboard), keeping almost everything on left click.
- **Left-drag** on a card moves it (or the whole selection). On empty table it pans the view.
- **Left click** selects a card. **Ctrl + click** adds a card to or removes it from the selection.
- **Shift + left-drag** draws a selection box.
- **Shift + right-drag** draws a fence directly, without switching tools.
- **Right click** opens the options menu (favorite, merge copies, tags, and so on). Nothing core depends on it.
- **Scroll wheel** zooms.
- Tools in the bottom bar: **Hand** (default) and **Pencil** (draws fences). Choosing the Pencil from the palette is a toggle: it stays on until you switch back.
- Keyboard shortcuts are optional accelerators, e.g. H Hand, P Pencil, Delete removes the selection, Ctrl+S saves.

### Cards as physical objects
- Cards are dragged from search (or favorites) onto the table. There is no deck list to click into.
- Cards can be moved freely, thrown, and stacked.
- Card count on the table is theoretically unlimited.
- Cards can be piled to keep rendering tidy.
- Duplicates: by default every copy is its own card (16 Islands means 16 cards). There is a global setting for this, and it defaults to off.
  - Right-click a card > **Merge copies** to combine copies of the same card into one card with a count badge (Island ×16). Merging matches by card name (names are unique in Magic).
  - A merged card keeps each copy's individual printing and art, both on the table and in export. Hovering over it shows the printings inside. *Open: exact hover/expand interaction.*

### Feel and physics
- Tactile and pleasant, but never in the way of building a deck well.
- A held card feels like it's in your hand: smooth, not snappy.
- Cards can be thrown.

### Snapping
- **Open table:** generous magnetism to a background grid. While dragging, the landing spot shows as a highlight and the card stays under the cursor. Grid snap can be turned off.
- **Adding to other cards** (stepped/cascaded stacks): strict. The card must be very close to attach, so it never joins a stack by accident.

## Fences (sections)

- Fences are drawable zones that sit behind cards, inspired by desktop "Fences".
- Every card inside a fence belongs to that fence's section. Membership is decided by the card's **center point**.
- Built-in sections: **Main**, **Sideboard**, **Maybeboard**, **Commander(s)**. Users can draw **custom** fences.
- **Creating a fence:** draw it (Pencil or Shift + right-drag), then pick a section for it from a list (Main, Sideboard, Maybeboard, Commander) or create a new named section. Then drag cards in.
- Fences can be resized in Hand mode by dragging their edges, with no need for the Pencil. *Open: whether fences also grow automatically to fit the cards dropped in.*
- The fence's **name floats above it** on the table. It isn't a header bar inside the frame.
- **Hover options:** hovering over a fence shows controls next to its name: a **View** dropdown, an **Analytics** dropdown, and a **Stack/Unstack** button.
- Fences are resizable. Moving a fence moves every card inside it.
- A fence can be **collapsed**: its cards gather into a single face-down stack (card backs showing) and spread back out when reopened, like closing and opening a folder. The fence shrinks to fit the pile. Cards never leave the table, and a collapsed fence is never replaced by an icon.
- Cards outside all fences can optionally be exported under a **Misc.** section.

### Views
- Each fence's default view is **Custom**: cards stay exactly where you arranged them.
- Other views: by CMC, type, color, or tags (an Untagged cluster, then one cluster per tag).
- Switching back to Custom restores your own arrangement.
- Default behavior is a **one-time sort**: cards are arranged once and stay hand-editable.
- An optional "auto-maintain" mode is wanted. *Open: needs more design.*

### Groups (tags)
- Tags work like counters placed on cards, and a fence's Tags view sorts cards into clusters by tag.
- The **tag tray** lives in the top-right corner: a small **#** tab that expands into the tray when clicked. Type a tag and press Enter to create it, then drag it onto individual cards.
- *Open: whether Scryfall's community tags (e.g. "ramp", "removal") are useful for suggesting tags.*

### Analytics panel
Each fence has an analytics panel, opened from its Analytics dropdown. The panel is part of the fence: it lives on the table, attached to the fence's right edge, moves with it, and draws above cards. It can be **pinned** to stay open. It holds:
- CMC graph
- Type graph
- Pips (color balance by mana symbols)
- Color Identity (color balance by cards' color identity)
- Optimal mana source distribution, using Frank Karsten's mana source math
- Analytics lists show colors as mana symbols, not color names.

## Formats

- Choose a format before building, and change it while building.
- Possibly auto-detect the format.
- Export with no format, for custom play.
- Custom formats: legality by set or date range, custom banlists, preset custom zones.

## Search

- Backed by Scryfall data.
- Richer filtering than Scryfall's text syntax: printing, art, and similar.
- Display setting (Show): **Unique Print** (every unique printing), **Unique Card** (unique card names, latest printing only), or **Unique Art** (every printing with unique art).
- Set selector dropdown to limit results to a set.
- Sort by price, name, CMC, color, or color identity (ordered W, U, B, R, G).
- Star a card to favorite it.

## Favorites

- Add by starring in search, dragging a card from the table into Favorites, or right-click > Add to favorites.
- Favorite cards' images are kept in a persistent local cache.

## Collection (later phase)

- A library of owned cards, saved locally with images.
- Add cards from search, or import from other sources with a **preview before committing**.
- A per-table toggle highlights cards you don't own.

## Card data, images, and prices

- Card search uses the Scryfall API directly (needs internet). Card data is saved with each card added to the table, favorites, or collection, so legality, analytics, and export work offline.
- Images from searches are cached temporarily and cleared when the app closes. Images for favorites and collection are saved permanently.
- Prices: whatever Scryfall carries (USD/TCGplayer, EUR/Cardmarket, MTGO tix).

- Saved tables use a `.table` file type.

## Saving and export

- One save file per table (a table is usually one deck).
- Export as plain text with section headers, or in specific formats (e.g. Arena, Moxfield, MTGO). Each section becomes a header with its cards listed under it.

## Open items

- Auto-maintain view behavior.
- Which specific export formats to support first.
