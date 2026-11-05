# Table: Design

Status: phase 1 done (requirements + high-level design). Phase 2 (system design) in progress. Started 2026-10-31.

## Tech stack (proposed by Claude; user defers stack choices)

- **Shell:** Tauri (Rust backend, system webview) for low memory use.
- **Rust backend:** card database in SQLite with full-text search, daily Scryfall bulk sync, image cache (size-limited, plus permanent cache for favorites and collection), save/open table files, export.
- **Table rendering:** PixiJS on the GPU, with a small custom physics layer (drag lag, throws, friction, snapping). No full physics engine.
- **UI around the table:** React + TypeScript.

## Code layers (proposed by Claude, awaiting user's organization preferences)

1. **Model:** plain data and operations (cards, piles, fences, tags, views). No UI, fully testable.
2. **Rules:** formats, legality, analytics as pure functions over the model.
3. **Table:** renderer, input, tools, physics, snapping. Reads the model, sends actions to change it.
4. **UI:** React panels and edge bubbles. Same rule as the table.
5. **Backend:** Rust services, reached through a small set of commands.

Open question: organize folders by layer or by feature, and how strict the boundaries are.

## Component hierarchy (user's draft, 2026-10-31)

The hierarchy also defines how data is handed around: parents own data and pass it down.

```
Container
    Navigation Bar
        Search Button
        Favorites Button
        Collection Button
    Modules
        Search
            Search Input
            Show Dropdown
                Unique Print - every unique printing
                Unique Card  - just unique card names (latest printing only)
                Unique Art   - every printing with unique art
            Set Selector dropdown
                All sets and editions
            Sort button
                Name, CMC, CI/color, price; each asc/desc
            Results (scroll, paginated)
                Card object, in rows of 2-4
                    Image key and data object
                    Favorite button
        Collection
            Collected cards (scroll, paginated)
                Same card object
        Favorites
            Favorite cards (scroll, paginated)
                Same card object
    Board
        Fence
            Name
            Is stacked
            Groups (derived from tags)
            View mode
            Analytics
                Various data from cards in the fence
        Same card object
            Position
    Tag Pane
    Tool Selector
    Utility Bar
    View Controller
    (Modal) Settings
```

### Notes on the draft

- **One card object everywhere.** Search, Collection, Favorites and the Board all use the same card object (image key + card data). The Board adds position.
  - Built (2026-11-01): `Card {id, copies, tagIds}` in `model/types.ts`. `TableCard` extends it with x, y and rotation. `model/card.ts` holds `makeCard`, `cloneCard`, `faceOf` and `nameOf`.
  - Every side panel shows its cards with the one `cards/CardTile` component. Switches turn its abilities on or off: drag out, Shift+click pick, and the − N + stepper. A card in a panel never moves.
  - Taking a card out of a panel (dragging it, or pressing +) puts a copy of that object on the table, keeping its printings and tags.
- **Derived, not stored.** A fence's groups come from its cards' tags, and its analytics come from its cards. Both are computed rather than saved.

## Tag Pane and card details (user, 2026-10-31)

```
Tag Pane
    Tag Input            type a name, Enter creates a tag
    Tag object
        Name
        Counter          derived: number of cards on the table with this tag
        (drag onto a card object on the table to apply it)

Card object (on the Board)
    Position
    Tags
    Merged (bool)
    Merge count (int)
    Visuals: merge-count badge, tag counters
```

Agreed: store a merged card as a list of its copies (each with its own printing), and derive *merged* (more than one copy) and *merge count* (number of copies) from that list. That keeps each copy's art for export and means the count can never disagree with the copies.

## Remaining components (Claude's proposal)

```
Tool Selector                      bottom-edge bubble
    Hand button                    default; H
    Pencil button                  toggle; P
    (Shift + right-drag draws a fence without changing the active tool)

Utility Bar                        bottom-edge bubble
    Deck Name Input
    Format Selector                built-in formats + custom formats
    New / Open / Save buttons      call the backend; warn on unsaved changes
    Export button                  opens Export dialog (target format, include Misc.)

View Controller                    bottom-edge bubble; the table "camera"
    Zoom out / zoom level / zoom in
    Fit all cards
    (holds camera position + zoom that the Board draws through)

(Modal) Settings
    Theme (dark/light) and accent color
    Grid snap on/off
    Merge duplicates by default (off)
    Image cache size, clear cache
    Card data: last updated, refresh now
    Keyboard shortcuts list
```

## Shared table state (agreed)

One table state lives at the Container. Components read only the part they need and change it by sending named actions, rather than passing data between siblings.

- **Stored:** cards (with position, tags, copies), fences (name, bounds, stacked, view mode, saved Custom layout), tags, deck name, format, camera, selection, active tool.
- **Derived (computed, never saved):** which fence a card belongs to (by center point), tag counters, fence groups, analytics, legality.
- **Example actions:** add card, move cards, tag card, merge copies, draw fence, set fence view, stack/unstack fence, rename deck, set format, new/open table.
- The save file is the stored part (minus camera/selection), written by the backend.

## Next steps

## System design (phase 2)

### Code organization (agreed: folders by feature)

```
src/                      React + TypeScript
    app/                  Container, layout, theme
    model/                shared card object, table state, actions (no UI)
    cards/                CardTile: the one card component every side panel uses
    search/               Search module + its UI
    favorites/
    collection/
    board/                PixiJS table: camera, rendering, input, physics, snapping
    fences/               fence model ops, views, stack/unstack, analytics panel
    tags/                 Tag Pane, tag ops
    tools/                Tool Selector
    utility/              Utility Bar, export dialog
    settings/
    rules/                formats, legality, analytics math (pure functions)
src-tauri/                Rust
    scryfall/             API client
    images/               image cache
    files/                .table open/save, export
    library/              favorites + collection storage
```

Rule: a feature folder may use `model/` and `rules/`, but not reach into another feature's internals.

### Card data: Scryfall API (agreed 2026-10-31)

- Search calls the Scryfall API directly. It already supports unique cards / prints / art, set filters, and sorting.
- This replaces the earlier plan of downloading Scryfall's bulk data. Trade-off: search needs internet and each search takes a moment, but there is nothing to download or sync.
- When a card is added to the table, favorites, or collection, its full card data is saved with it. Legality, analytics, and export then work offline.
- Scryfall asks clients to send a User-Agent and Accept header and to keep to roughly 10 requests per second. The Rust client handles both.

### Image cache (agreed)

- Images from searches go in a temporary cache that is cleared when the app closes.
- Images for favorites and collection cards are saved permanently.
- Images for cards on the table: *proposal* — cached alongside the .table file's cards so reopening a deck is instant.

### .table file (proposal)

- A `.table` file is JSON: format version, deck name, format, tags, fences (name, bounds, section, stacked, view mode, saved Custom layout), and cards (Scryfall id, saved card data, position, tags, copies).
- Camera position is saved too, so a table reopens where you left it.

### Backend commands (proposal)

What the React side can ask the Rust side to do:
- `search(query, show, set, sort, page)`, `get_card(id)`, `list_sets()`
- `get_image(card, size)`: returns a cached image path, downloading if needed
- `open_table(path)`, `save_table(path, data)`, `export_table(data, format)`
- `favorites_list / add / remove`, `collection_list / add / remove / import_preview / import_commit`

### Physics and snapping (Claude's call, to tune in phase 4)

- Held card follows the cursor with a short ease (about 60 to 80 ms behind) and tilts slightly in the direction of movement.
- Thrown cards keep their release speed and slow down with friction, stopping within roughly a quarter second.
- Grid: 24 px. Open-table grid snap radius: about half a card width, shown as a landing highlight.
- Stack snap radius: about 12 px from the stacking position, so it only triggers on purpose.
- Stepped stack offset: just enough to show each card's name strip.


## Formats and legality (phase 3, for review 2026-11-01)

### Agreed with the user

- A format dictates **zones, counts, and legality checks**. Land count is not a format property.
- Built-in formats use Scryfall's legalities. Custom formats list legal/illegal **sets and cards** themselves.
- The copy limit (singleton, 4, or any number) is set **once per format**. Basic lands are always exempt.
- A custom format has a zone list (add, remove, rename), a count per zone, type restrictions, and a color rule (a fixed rule, or follow a zone, such as the command zone's color identity).
- Top-level fences are the format's zones. Drawing a fence **inside** a fence makes a **group** in that zone (e.g. "Combo pieces" inside Main). Its cards count toward the zone, and it exports as a subheader.
- The Tags view generates groups automatically, one per tag.
- **Maybeboard** is always offered in the section picker but isn't on the table by default. It is a default misc section: not part of the deck, no legality checks.
- Cards outside every fence stay "Misc." (optional in export).

### Add Format (user, 2026-11-01; built)

The format dropdown in the Utility Bar ends with **+ Add format…**, which opens a modal:

```
Name
Zones            rows of name + count; add/remove (the first zone is the library for the mana math)
Max copies       1 = singleton; basic lands exempt
Sets             "Illegal sets" or "Legal sets only", plus a list of sets (from Scryfall's set list)
Banned cards     list of card names
```

- Custom formats are saved in the app, and a copy goes into any .table file that uses one, so a shared file opens elsewhere.
- Built-in formats have the same shape (Constructed: Main 60 + Sideboard 15, 4 copies; Commander: Main 99 + Commander 1, singleton; Limited: Main 40) and use Scryfall's legalities.
- When a fence is drawn, the section picker offers the format's zones, then Maybeboard.
- The type restrictions and color rules from the earlier list were left out of the modal.

### Still to design: showing legality

Not built yet. Proposal: zone counts on fence headers (e.g. 97 / 99), a warning badge on cards that break a rule, and a Legality section in fence analytics.
