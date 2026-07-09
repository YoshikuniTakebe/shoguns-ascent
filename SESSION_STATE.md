# SESSION_STATE.md - Shogun's Ascent Project Documentation

## Project Overview

**Shogun's Ascent** is a digital implementation of a board game where 2-8 players compete as feudal Japanese clans for dominance through political mandates, territorial control, monster summoning, and warfare. The game spans three seasons (Spring, Summer, Autumn) followed by a Winter scoring phase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 6 |
| Build Tool | Vite 8 |
| State Management | Zustand 5 |
| Server | Express 5 + WebSocket (ws) |
| Database | better-sqlite3 (persistent game storage, auth) |
| Authentication | bcryptjs + jsonwebtoken |
| Dev Tools | tsx (server runtime), oxlint (linting) |
| Package Manager | npm |

## Architecture

### State Flow

```
GameState (src/types/game.ts)
    |
    v
gameLogic.ts (pure functions) <--- Server calls these for online mode
    |
    v
gameStore.ts (Zustand store) <--- UI reads from here, dispatches actions
    |
    v
Components (React) <--- Render based on store state
```

### Key Patterns

1. **Pure Game Logic**: All game rules are implemented as pure functions in `gameLogic.ts`. Functions receive `GameState` and return a new `GameState`.

2. **WebSocket Communication**: Online mode uses a WebSocket server (`src/server/index.ts`) that receives player actions, applies game logic, and broadcasts the updated state to all clients.

3. **Interactive Popup Pattern**: Complex multi-step interactions follow this pattern:
   - State flag (e.g., `zorroPlacementActive`) + `playerId` + remaining count
   - UI state in store (e.g., `warPhasePopupVisible`)
   - Ready-player arrays (e.g., `warPhaseReadyPlayers`) for multi-player acknowledgment
   - Server case handlers accumulate `readyPlayers` then transition state when all players are ready

4. **Hotseat vs Online Mode**: Both modes share the same game logic. In hotseat mode, actions are applied locally. In online mode, actions are sent to the server which applies them and broadcasts state.

5. **Dual Implementation Pattern**: Certain interactive features (like monster placement, Daikaiju flow) need implementation in both:
   - `gameStore.ts` for hotseat mode
   - `server/index.ts` for online mode

### File Structure

| File | Role | Lines (approx) |
|------|------|----------------|
| `src/types/game.ts` | All TypeScript interfaces, card/province/clan data, GameState | Large |
| `src/utils/gameLogic.ts` | Pure game logic functions (calculateForce, battle resolution, mandates, kami, war phase) | ~5000+ |
| `src/store/gameStore.ts` | Zustand store with UI state, WebSocket communication, action handlers | ~4000+ |
| `src/server/index.ts` | Express + WebSocket server, all online multiplayer action handlers | ~2500+ |
| `src/components/GameBoard.tsx` | Main game board component with map, popups, interactive overlays | Large |
| `src/components/BattlePanel.tsx` | War phase battle resolution UI | Medium |
| `src/components/PlayerPanel.tsx` | Player info display (coins, VP, figures, cards) | Medium |
| `src/i18n/en.ts` | English translations | Large |
| `src/i18n/es.ts` | Spanish translations | Large |

### Components

| Component | Purpose |
|-----------|---------|
| `GameBoard.tsx` | Main game board with map, province rendering, popup overlays |
| `BattlePanel.tsx` | Battle resolution UI (bidding, tactics, results) |
| `BattleBiddingOverlay.tsx` | Bidding overlay for war tactics |
| `PlayerPanel.tsx` | Player information display |
| `ActionPanel.tsx` | Current player action controls |
| `HonorTrack.tsx` | Honor ranking display |
| `PoliticsTrack.tsx` | Mandate selection track |
| `TemplePanel.tsx` | Kami temple and worship UI |
| `SeasonCardsMarket.tsx` | Card purchasing during train mandate |
| `SeasonCardsModal.tsx` | View owned season cards |
| `PlayerCardsModal.tsx` | View player card details |
| `RegionCard.tsx` | Individual province card display |
| `RegionDetailModal.tsx` | Province detail popup |
| `HarvestPopup.tsx` | Harvest rewards display |
| `KamiResolutionPopup.tsx` | Kami ability resolution |
| `KamiSummaryPopup.tsx` | Kami phase summary |
| `GameLog.tsx` | Game event log |
| `AllianceDisplay.tsx` | Alliance information |
| `HostagesModal.tsx` | Hostage display |
| `WarTokensModal.tsx` | War province tokens display |
| `TradeModal.tsx` | Trade interface |
| `TradeOfferPopup.tsx` | Trade offer notification |
| `GameOverScreen.tsx` | End-game scoring and results |
| `MainMenu.tsx` | Main menu / game setup |
| `AuthScreen.tsx` | Login/registration |
| `GamesLobby.tsx` | Online game lobby |
| `ReplayViewer.tsx` | Game replay playback |
| `ClanShields.tsx` | Clan shield/emblem graphics |
| `DaimyoPortraits.tsx` | Daimyo portrait graphics |
| `Icons.tsx` | Shared icon components |
| `JapanMapBackground.tsx` | Map background rendering |

## Game Features (Implemented)

### Clans (8 total)

Each clan has unique starting honor and special abilities:

| Clan | Color | Home Province | Starting Honor | Income |
|------|-------|---------------|----------------|--------|
| Koi | Red | Kanto | 1 | 5 |
| Sol | Gold | Shikoku | 2 | 7 |
| Loto | Purple | Nagato | 3 | 7 |
| Tortuga | Green | Edo | 4 | 6 |
| Libelula | Blue | Hokkaido | 5 | 6 |
| Zorro | Orange | Kansai | 6 | 5 |
| Bonsai | Yellow | Kyushu | 7 | 4 |
| Luna | Silver | Oshu | 8 | 4 |

### Provinces (8 + Ocean)

| Province | Adjacent | Sea Routes | Harvest Rewards |
|----------|----------|------------|-----------------|
| Hokkaido | None | Oshu, Kansai, Kyushu | 2 Ronin |
| Oshu | Edo, Kanto | Hokkaido | 3 Coins |
| Edo | Oshu, Kanto, Kansai | None | 4 VP |
| Kanto | Oshu, Edo | None | 2 VP, 2 Coins |
| Kansai | Edo, Nagato | Hokkaido, Kyushu, Shikoku | 3 VP |
| Nagato | Kansai | None | 1 VP, 1 Coin, 1 Ronin |
| Shikoku | None | Kansai, Kyushu | 3 Coins |
| Kyushu | None | Shikoku, Kansai, Hokkaido | 1 VP, 1 Coin, 1 Ronin |
| Ocean | None | None | None (Daikaiju staging area) |

### Mandate System (5 types)

- **Recruit**: Summon Bushi/Shinto figures to provinces
- **Marshal**: Move figures between provinces (land adjacency + sea routes)
- **Train**: Purchase season cards from the market
- **Harvest**: Collect rewards from controlled provinces
- **Betray**: Replace enemy figures with your own (breaks alliances)

### War Phase

The war phase activates at the end of each season. Flow:

1. **War Upgrades**: Players with war upgrade cards receive bonuses (coins, taking coins from others)
2. **Daikaiju Placement** (if active): Owner selects any province; all fortresses destroyed
3. **Uncontested Provinces**: Provinces with only one clan auto-resolve
4. **Battles**: Multi-clan provinces resolve through combat

Battle Resolution:
- Force calculation (Bushi = 1, Daimyo = 1+upgrades, Shinto = 0, Monsters = variable, Fortresses = 1)
- War tactics bidding: Seppuku, Take Hostage, Hire Ronin, Imperial Poets
- Winner receives war province token
- Loser figures are killed (unless Mercy virtue applies)

### Kami System (7 types)

Temples with shrine positions where Shinto figures worship:

| Kami | Base Effect |
|------|-------------|
| Amaterasu | Move to top of Honor Track |
| Fujin | Perform up to 2 Movements |
| Hachiman | Gain 2 Ronin tokens |
| Raijin | Summon 1 Bushi to any Province |
| Ryujin | Acquire a Season Card (full cost) |
| Susanoo | Gain VP equal to number of Fortresses |
| Tsukuyomi | Gain 2 Coins |

Expansion kami variants are also implemented with province-based effects.

### Season Card System

Cards are organized by season (Spring/Summer/Autumn) and type:
- **Virtues**: Passive abilities that trigger on specific game events
- **Monsters**: Powerful figures placed on the map
- **Upgrades**: Permanent enhancements to game actions
- **War Upgrades**: Bonuses at the start of war phase
- **Winter Upgrades**: End-game scoring bonuses

### Alliance System

- Players can form alliances during Tea Ceremony
- Allies share benefits but can betray each other
- Alliance duration tracked per season
- Betray mandate breaks alliances

### Additional Features

- **Tea Ceremony**: Pre-politics phase for alliance negotiations
- **Online Multiplayer**: WebSocket-based real-time multiplayer with lobby system
- **Hotseat Mode**: Local multiplayer on one device
- **Game Replay System**: Full game replay with step-by-step playback
- **Persistent Games**: Save/load using SQLite database
- **Authentication**: User registration and login with JWT tokens
- **Internationalization**: Full English and Spanish translations

## Recent Changes (This Task)

### FEAT-001: Bishamon Force Fix

**Problem**: Bishamon (su-bishamon) was using Force 4 whenever any other monster existed in the same province, including monsters owned by the same player.

**Fix**: Changed the condition to check `f.owner !== fig.owner` so Bishamon only gets Force 4 when an opponent's monster (from a different clan) is present in the same province. Same-clan monsters no longer trigger the boost.

**Location**: `src/utils/gameLogic.ts`, calculateForce function, su-bishamon case.

### FEAT-002: Daikaiju Rework (Interactive Province Selection)

**Complete interactive flow**:

1. When Daikaiju (au-daikaiju) is summoned, it is placed in the Ocean province (not accessible to other players)
2. At the start of war phase, after all players dismiss the war upgrade summary popup:
   - If a player owns Daikaiju, `daikaijuPlacementActive = true`
   - The Daikaiju owner gets a popup to select ANY province
   - Other players see a "waiting" message
3. Once the owner clicks a province:
   - Daikaiju moves from Ocean to the chosen province
   - ALL fortresses in that province are destroyed (including owner's own and Tortuga's)
   - Fortress counts returned to respective players
4. A summary popup shows all players: which province, how many fortresses destroyed, whose fortresses
5. All players must click "Accept" before the game continues to battle resolution

**State properties added to GameState**:
- `daikaijuPlacementActive: boolean`
- `daikaijuPlacementPlayerId: string | null`
- `daikaijuSummaryVisible: boolean`
- `daikaijuSummaryReadyPlayers: string[]`
- `daikaijuSummaryData: { provinceId, provinceName, destroyedFortresses[] } | null`

**Server messages**: `DAIKAIJU_PLACE_PROVINCE`, `DAIKAIJU_SUMMARY_READY`

### FEAT-003: All 14 Virtue Cards Implemented

#### Spring Virtues

| Card | ID | Cost | Trigger | Effect |
|------|----|------|---------|--------|
| Benevolence | sp-benevolence | 1 | When spending coins on train (buying a card) | Auto-gives 1 coin to poorest player, +Honor, +2 VP |
| Courage | sp-courage | 3 | Winning a war province token | +2 VP |
| Dignity | sp-dignity | 1 | Summoning a monster | +2 VP |
| Generosity | sp-generosity | 0 | After playing any mandate | Auto-gives 1 coin to poorest player (if has coins), +Honor |
| Honesty | sp-honesty | 0 | Selecting a non-Betray mandate while having an ally | +2 VP |
| Piety | sp-piety | 1 | Winning war with a Shinto in the battle province | +Honor, +3 VP |
| Righteousness | sp-righteousness | 2 | Any of your figures are killed | +1 VP per figure killed |

#### Summer Virtues

| Card | ID | Cost | Trigger | Effect |
|------|----|------|---------|--------|
| Justice | su-justice | 1 | Killing figures of a player with less Honor | +3 VP per affected player |
| Loyalty | su-loyalty | 1 | Whenever gaining VP (if has ally) | +1 extra VP |
| Mercy | su-mercy | 1 | Winning battle where kills would happen | +2 VP, enemy figures survive (automatic) |
| Patience | su-patience | 1 | End of Kami turn | +1 VP if not leading in VP |
| Respect | su-respect | 0 | Taking hostages in battle | +1 additional hostage |
| Sincerity | su-sincerity | 1 | Taking a hostage | +Honor, +1 extra VP |

#### Autumn Virtues

| Card | ID | Cost | Trigger | Effect |
|------|----|------|---------|--------|
| Boldness | au-boldness | 2 | Killing enemy Oni in battle | +4 VP per enemy Oni killed |

#### Implementation Details

- **hasCard** helper function exported from gameLogic.ts for checking if a player owns a specific card
- **applyLoyaltyBonus** helper applies +1 VP when gaining VP with an ally (avoids infinite recursion)
- **applyRighteousnessVP** helper for tracking kills and awarding VP
- **Mercy** completely prevents killing when active: wraps all kill logic, death triggers (Koneko/Ebisu/Jikininki), figure removal, and Phoenix revival
- **Righteousness** triggers in 5 locations: battle casualties, seppuku, Fire Dragon, Oni of Hate, and betray figure replacement
- **Loyalty** bonus applied at major VP gain points (battle wins, hostage taking, seppuku, kitsune, imperial poets)
- **Generosity/Benevolence** auto-select the poorest player as coin recipient
- **Dignity** implemented in both gameStore.ts (hotseat) and server index.ts (online mode)
- All virtue triggers generate log messages visible to players

## Key Game Logic Functions

Located in `src/utils/gameLogic.ts`:

| Function | Purpose |
|----------|---------|
| `createInitialGameState()` | Initialize a new game |
| `calculateForce()` | Calculate combat force for a figure |
| `initiateWarPhase()` | Set up war phase (upgrades, tokens, Daikaiju check) |
| `resolveNextBattle()` | Resolve a single battle in a province |
| `resolveUncontestedBattles()` | Handle provinces with only one clan |
| `executeMandate()` | Process a mandate action |
| `chooseMandateTile()` | Select mandate for the turn |
| `resolveKamiTurn()` | Process all kami temple effects |
| `applyFireDragonEffect()` | Fire Dragon pre-battle ability |
| `gainHonor()` | Move player up the honor track |
| `loseHonor()` | Move player down the honor track |
| `hasCard()` | Check if a player owns a specific season card |
| `applyLoyaltyBonus()` | Apply Loyalty virtue bonus (+1 VP with ally) |
| `applyRighteousnessVP()` | Apply Righteousness virtue bonus (+1 VP per killed figure) |

## Monsters (Partial List of Notable Monsters)

| Monster | Season | Force | Effect |
|---------|--------|-------|--------|
| Bishamon | Summer | 1 (4 with opponent monster) | Force 4 when opponent monster in same province |
| Daikaiju | Autumn | 5 | Placed in Ocean, owner picks province in war phase, destroys all fortresses |
| Fire Dragon | Summer | 3 | At start of battle, kills 1 figure of each player |
| Earth Dragon | Spring | 3 | At start of battle, moves 1 figure of each other player out |
| Oni of Skulls | Spring | 3 | Force 3 where you have lowest Honor |
| Oni of Blood | Summer | 2/4 | Force 4 where you have lowest Honor |
| Oni of Hate | Autumn | 4 | When entering a province, kills 1 figure there |
| Phoenix | Spring | - | If killed, gains 1 VP and returns immediately |
| Jorogumo | Spring | - | Takes control of 1 enemy figure during battle |
| Komainu | Spring | - | Counts as a Shinto |
| Koneko | Summer | - | If killed, gain 2 Coins + 2 Ronin; enemies lose same |
| Jikininki | Summer | - | Gain 1 VP per figure killed in same province |
| Nure-Onna | Summer | 2 | Can cross sea route to join a battle |

## Development Patterns for Future Work

### Adding a New Interactive Feature

1. Add state properties to `GameState` interface in `src/types/game.ts`
2. Initialize them in `createInitialGameState()` in `gameLogic.ts`
3. Add game logic in `gameLogic.ts` (pure function)
4. Add store action in `gameStore.ts` for hotseat mode
5. Add server handler in `server/index.ts` for online mode
6. Add UI popup/overlay in appropriate component (usually `GameBoard.tsx`)
7. Add i18n translations in `en.ts` and `es.ts`

### Adding a New Virtue Card

1. Add card data to `SPRING_CARDS`, `SUMMER_CARDS`, or `AUTUMN_CARDS` in `game.ts`
2. Find the appropriate trigger point in `gameLogic.ts` (e.g., battle resolution, mandate execution)
3. Use `hasCard(player, 'card-id')` to check if the player owns the card
4. Apply effect and add log message
5. Consider interactions with `applyLoyaltyBonus` (VP gains) and `applyRighteousnessVP` (kills)
6. If the card affects hotseat-only flows (like monster placement), also add logic in `gameStore.ts`

### Multi-Player Acknowledgment Pattern

```typescript
// In GameState:
featureVisible: boolean;
featureReadyPlayers: string[];

// In server handler:
case 'FEATURE_READY':
  state.featureReadyPlayers.push(playerId);
  if (state.featureReadyPlayers.length === state.players.length) {
    state.featureVisible = false;
    state.featureReadyPlayers = [];
    // Continue game flow...
  }
  broadcastState();
  break;
```

### Force Calculation Pattern

Force is calculated per-figure with context-sensitive bonuses:
- Base force from figure type (bushi=1, fortress=1, daimyo=1+upgrades)
- Monster force from card data + conditional bonuses
- Upgrades that modify force (Path of the Lion, Path of the Favored, etc.)
- Special conditions (Bishamon needs opponent monster, Oni needs lowest honor)

## Running the Project

```bash
# Install dependencies
npm install

# Run development server (frontend)
npm run dev

# Run WebSocket server (online multiplayer)
npm run server

# Build for production (TypeScript check + Vite build)
npm run build

# Lint
npm run lint
```

## Known Considerations

- The `ocean` province is excluded from: war token selection, map rendering, RegionCard list, movement destinations, harvest rewards, and marshal options
- `detectWarTransition` blocks battle start when `daikaijuPlacementActive` or `daikaijuSummaryVisible` is true
- `gainHonor()` is void/mutative - use directly without reassigning state
- Loyalty virtue must not trigger on itself to avoid infinite recursion
- Mercy completely prevents ALL kill-related logic when active (including death triggers for Koneko, Ebisu, Jikininki, and Phoenix revival)



## Changelog - 2026-07-09 (Bugfixes, virtues, config, friends, lobby & game-creation overhaul)

Worked directly on `main`. Full `npx tsc -b` and `npm run build` pass.

### Game logic fixes

- **Dignity (`sp-dignity`) on ocean summons**: Removed the `provinceId !== 'ocean'` guard in
  `gameStore.ts` (`doPlaceMonster`) and `server/index.ts` (`MONSTER_PLACED`). Summoning a monster
  into the Ocean (e.g. Daikaiju) now correctly grants +2 VP, since it is still a summon.

- **Path of the Warlord (`sp-path-of-the-warlord`) — +1 coin per Summon**: Newly implemented.
  Added helpers in `gameLogic.ts`: `grantWarlordSummonCoin(state, playerId)` (immutable, one coin
  if the player owns the card) and `grantRecruitWarlordCoinOnce(state, playerId)` (awards at most
  once per recruit turn via the new optional `GameState.recruitWarlordCoinAwarded` flag, reset in
  `advanceRecruitResolution`). Summons that grant the coin:
  - **Recruit mandate** = a single summon regardless of how many figures are placed
    (`recruitPlaceFigure`, `recruitPlaceDaimyo`, temple-shinto placement in store + server).
  - **Raijin shrine effect** (hotseat `doRaijinPlace`, revertable by undo snapshot; server at
    `RAIJIN_CONFIRM`), awarded to whoever executes the summon.
  - **Buying/placing a monster on the board** (province incl. Ocean, and Komainu/Hotei at a
    temple) via `doPlaceMonster`, `doKomainuPlaceAtTemple`, server `MONSTER_PLACED` province +
    temple branches.
  - **No coin** when the figure cannot be placed and goes to reserve (e.g. Luna with no space).

### UI fixes

- **Shrine monster tooltips** (`TemplePanel.tsx`): monster icons in shrines now show the same rich
  hover tooltip as the map (`ShrineMonsterTooltip` + `figure-icon-wrapper`), replacing the plain
  `title` attribute. Shows name, Force and effect.
- **Kami shrine popup breakdown** (`TemplePanel.tsx`): replaced the `(Fuerza: X)` text with a Fist
  (force) icon + number. Each clan row now shows the Shinto icon + count of normal shinto and the
  name(s) of any shinto-monsters (Komainu/Hotei).
- **Bushi Dragonfly (libelula) figure size** +2%: `RegionDetailModal.tsx` `FIGURE_SIZE_OVERRIDES`
  `bushi-libelula` 0.87 -> 0.8874.

### Admin server config (hidden from users)

- `config.ts`: `getServerWsUrl()` / `getConfiguredServerUrl()` / `setConfiguredServerUrl()` — the
  server URL is an admin-only setting persisted in localStorage (`shoguns-ascent-serverUrl`),
  falling back to the derived `WS_BASE`. Removed the "Server" URL inputs from the online
  create/join forms; the URL is now injected transparently.
- `ConfigModal.tsx`: admin-only config panel (server URL). A **Config** button (gear) appears in
  the MainMenu and GamesLobby headers only when `authUser.isAdmin`.

### Friends system

- DB (`server/database.ts`): new `friends` table + `findUserByUsernameOrEmail`, `addFriend`,
  `getFriends`, `areFriends`.
- REST (`server/index.ts`): `POST /api/friends/add` (search by username or email; returns the
  friend or 404), `GET /api/friends` (list). `getAuthUserId(req)` helper.
- UI (`FriendsModal.tsx`): `AddFriendModal` (title "Introduce usuario o email de tu amigo",
  confirmation "X ha sido añadido a tu lista de amigos!") and `FriendsListModal`. Add-friend
  (person+) and friends-list (two-people) buttons next to username/logout in MainMenu + GamesLobby.

### Lobby list UI (`GamesLobby.tsx`)

- Game identifier shown in parentheses after the name: `getGameIdentifier` = `DDMMYYHHMM`
  (from `createdAt`) + a themed word derived deterministically from the game id.
- Creation date line added under each card title.
- Current-turn player's clan seal rendered large (64px) and centered.
- Player names laid out in a 4-per-row grid (`games-lobby-card-clans-grid`, 2 rows for up to 8).

### Game creation overhaul & matchmaking (Task partially requires live multiplayer testing)

- **Manual online create** (`MainMenu.tsx`): removed the single "Host clan" selector. Now shows one
  row per player: slot 0 is you (name shown) + clan selector; other slots pick a friend + clan, or
  are left **open** (anyone can Join). Invited friends + their reserved clans are sent to the server.
- **Random online create**: added an **"Invitar amigos"** section to invite friends; remaining
  uncovered slots become open.
- **Server** (`server/index.ts`): `Lobby` gained `invitedUserIds`, `invitedClans`, `createdAt`.
  `CREATE_LOBBY` stores invites; `JOIN_LOBBY` enforces invite/open rules (`openSlotCount`,
  `isOpenLobby`), auto-assigns an invited player's reserved clan, and de-dupes reconnections.
  New `GET /api/lobbies/visible` returns waiting lobbies where the user is host/invited or the game
  is open. `broadcastLobby` now includes `invitedUserIds` + `openSlots`.
- **Lobby UI**: a "waiting" section lists visible lobbies; invited/host/participant games get a
  pulsing highlight (`games-lobby-card-invited` blink) and a **Play** button; open games anyone can
  join show a **Join** button. Clicking connects and sends `JOIN_LOBBY`.
- **Note**: the real-time end-to-end matchmaking flow (invitee blink -> join -> waiting room ->
  host starts, open-slot Join->Play transition) is implemented at the data/UI layer but has not been
  verified with a live multiplayer session and may need follow-up tuning.

### i18n

- Added `config.*`, `friends.*`, and `lobby.*` (inviteFriends, invite, invited, join, openGame,
  openSlots, you, createdOn, etc.) keys to both `en.ts` and `es.ts`.
