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
| Mercy | su-mercy | 1 | When opponent figures could be killed | Owner chooses whether to leave the affected group alive and gain 2 VP |
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
- **Mercy** is an explicit owner choice in normal battle casualties, Fire Dragon, Oni of Hate, Way of the Keiri, and Path of the Ninja. It prevents death triggers and Justice for the spared group.
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
- Mercy only prevents kill-related logic for the group the owner explicitly spares; Keiri can choose independently per province.



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



## Changelog - 2026-07-09 (follow-up: lobby cards compacted + waiting-room navigation)

- **Compact lobby cards** (`GamesLobby.tsx` + `App.css`): `renderGameCard` and the waiting-lobby
  cards are now a single-row 3-column layout (left: name + `(identifier)` + creation date inline +
  player-name grid; center: compact turn seal at 38px; right: mode + date + progress + actions).
  `.games-lobby-card` is now `flex-direction:row`; added `.games-lobby-card-left/right`,
  `.games-lobby-card-title-row`, `.games-lobby-card-created-inline`. This significantly reduces card
  height (the previous stacked layout with a 64px seal took too much vertical space).
- **Create -> waiting room / back to lobby without a code**:
  - The waiting room "Volver" button now returns authenticated users to the **games lobby**
    (`screen: 'games-lobby'`) while keeping the socket + `lobbyState` alive, so the created lobby
    stays open and the host can re-enter it. Button label -> `lobby.backToLobby`.
  - `ws.onclose` on the `lobby` screen now routes authenticated users to `games-lobby` (instead of
    all the way back to `menu`).
  - `handleEnterLobby` (GamesLobby) reuses the existing open socket when re-entering the same lobby
    (host/participant) instead of opening a second socket that would tear down the lobby server-side.
  - Waiting room de-emphasizes the long game ID (now inside a collapsible `<details>`) and shows
    `lobby.friendsCanJoin`: invited friends join directly from their own lobby, no code needed.
  - The pre-game waiting section in the lobby is titled `lobby.pendingGames` ("Partidas por
    empezar") to distinguish it from the in-progress "Waiting" section.
- Note: the created lobby is still in-memory and tied to the host's WebSocket connection (it is
  destroyed if the host fully disconnects). Full persistence of pending lobbies would require
  storing them in the DB; flagged for follow-up.



## Changelog - 2026-07-09 (pending lobbies persisted — survive disconnect & server restart)

Waiting rooms (pre-game lobbies) are now persisted so a host/player disconnection — or a full
server restart — no longer loses the game.

- **DB** (`server/database.ts`): new `pending_lobbies` table + `savePendingLobby`,
  `getPendingLobby`, `getAllPendingLobbies`, `deletePendingLobby` (+ `DbPendingLobby` type). Stores
  id, name, host, maxPlayers, players (id/name/clanId), invitedUserIds, invitedClans, config and
  timestamps as JSON.
- **Server** (`server/index.ts`):
  - Lobby player `ws` is now `WebSocket | null` (null = disconnected/reserved slot or a lobby
    rehydrated from the DB). Added a `safeSend(sock, payload)` helper; all player broadcasts
    (`broadcastState`, `broadcastLobby`, rejoin/GAME_START) are null-safe.
  - `persistLobby(l)` writes the lobby to the DB on **create**, **join** and **clan-select**.
  - `lobbyFromPersisted` / `getOrRehydrateLobby` rebuild an in-memory lobby from the DB on demand
    (used by JOIN_LOBBY and SELECT_CLAN); all pending lobbies are also rehydrated on **server start**.
  - **Disconnect handling rewritten**: for a not-yet-started lobby, the host's and invited players'
    slots are *reserved* (socket set to null, player kept) instead of destroying the lobby; a random
    open-slot joiner's slot is freed. The lobby stays in memory and in the DB, so it survives even if
    everyone disconnects. Started-game rejoin behaviour is unchanged.
  - `startLobbyGame` calls `deletePendingLobby(l.id)` once the game starts (it becomes a normal
    persisted game).
- Reconnection relies on a stable player id, which for online play is the authenticated user id, so
  a returning host/invited player re-attaches to their existing slot (JOIN_LOBBY dedupe).
- **Verified**: `scripts/test-lobby-persistence.mjs` (WebSocket integration test) — a lobby survives
  a host disconnect and can be rejoined; a fresh server start rehydrates persisted lobbies into
  `/api/lobbies/visible`. `npx tsc -b` and `npm run build` pass. (`data/` is gitignored.)


## Changelog - 2026-07-11 (upgrade cards pass + lobby padding)

- Removed unused local asset `src/img/map-bn.png` (black-and-white map, untracked and no longer used).
- `App.css`: added `padding-left: 7px` to `.games-lobby-card-clan-entry-active`.
- Ignored obsolete GitHub PR #2; `main` remains the source of truth.

### Upgrade cards implemented / wired

- Added shared upgrade helpers in `gameLogic.ts` for card ownership, supply coin gains, VP gains,
  summon-triggered upgrades, and automatic fallback targeting for optional effects.
- **After Summon** upgrades now run from the same paths already used by recruit, Raijin, and monster
  placement:
  - `sp-path-of-the-warlord`: +1 coin after summon.
  - `sp-path-of-the-patron`: +2 coins after summon if higher honor than at least two players.
  - `su-path-of-the-monkey`: takes 1 coin from the richest opponent and loses honor.
  - `au-path-of-the-spirit`: +2 coins and +2 VP after summon if highest honor.
  - `sp-path-of-the-ninja`: kills the first valid enemy Bushi on the map and loses honor.
  - `sp-path-of-the-kenin`: places an extra Bushi in the first valid owned-fortress province.
- **End of Recruit**:
  - `sp-path-of-the-light`: places an extra Shinto at the first shrine with space.
  - `su-path-of-the-samurai`: places an extra Bushi in the first valid province.
- **Marshal**:
  - `sp-path-of-the-builder`: automatically builds a fortress at the first valid province if the
    owner can pay the fortress cost.
  - `sp-path-of-the-kannushi`: automatically moves one worshipping Shinto to another shrine with
    space.
  - `su-path-of-the-serpent`: charges 1 coin to players crossing sea routes; multiple Serpent owners
    can charge while the mover has coins.
- **Season start**:
  - `sp-path-of-the-pacifist`: at start of Summer/Autumn, +4 VP if not tied for/holding the most war
    province tokens.
  - `sp-path-of-the-salamander`: at start of Summer/Autumn, +3 coins and loses honor.
- **Kami**:
  - `sp-path-of-the-vassal`: after a Kami reward resolves, automatically pays 2 coins for +2 VP if
    affordable.
  - `au-way-of-the-snake`: after a Kami turn, starts a Betray mandate for the first owner. Server
    summary handling now preserves this Betray turn instead of restoring the normal next player.
- **Betray / Harvest / economy**:
  - `su-path-of-the-shadow`: +3 coins after playing Betray.
  - `au-path-of-the-unrighteous`: Betray gets 3 replacements instead of 2 and can target the same
    owner more than once.
  - `su-path-of-sengoku`: at end of Harvest, gains the Daimyo province reward if not already gained.
  - `su-way-of-the-merchant`: hooked into supply coin gains for seasonal income, Harvest rewards,
    Tsukuyomi, Sengoku, Shadow, Warlord/Patron/Spirit/Salamander, and war-upgrade coin income.

### Notes / follow-up

- The new optional upgrade effects are intentionally auto-resolved with deterministic fallback
  targets to keep the game flowing without adding many new popups in this pass. Follow-up UI can add
  explicit choices for Builder, Kannushi, Kenin, Light, Ninja, Monkey, Samurai, Snake and Vassal.
- `au-path-of-the-unrighteous` is wired for extra province replacements; replacing worshipping
  Shinto directly from temple UI still needs a dedicated selection flow if exact board-game fidelity
  is required.

## Changelog - 2026-07-13 (online Train reconnect + lobby turn indicator)

- Fixed an online Train deadlock after reconnecting: monster purchases now persist the pending card
  and buyer in `GameState` until `MONSTER_PLACED` completes. The buyer's placement UI is rebuilt
  automatically from server state after a disconnect, refresh, or server restart.
- Added backward-compatible recovery for snapshots created before the pending-placement fields
  existed. This recovers the affected Luna/Daikokuten game from its latest purchase log without
  editing the database.
- Invalid or duplicate online card purchases are no longer advanced silently by the server.
- Fixed the games-lobby current-turn marker. Saved `players_json` uses lobby order while GameState
  uses honor order; `formatGame` now resolves the active player (including Train/Marshal/Recruit,
  Harvest and Kami resolution) and maps that identity back to the returned lobby player array.
- Verified against the affected saved game: the recovered pending card is `sp-daikokuten`, the
  expected player is Luna/Yoshikuni, and the lobby now marks Luna/Yoshikuni as current player.
- Shrine monster tooltips are no longer clipped by the shrine tile: filled Kami slots allow visible
  overflow and rise above neighboring slots while hovered.
- Runtime note from the follow-up test: the process listening on port 3001 was still the pre-fix
  backend and returned the old raw index (`2`, Sol/Skyrunner). The corrected server returns mapped
  index `0` (Luna/Yoshikuni), so the backend must be restarted before validating these fixes.
- The old server allowed Luna to buy Jurojin after Daikokuten. The saved game now has Jurojin placed
  in Oshu and Daikokuten still owned but undeployed (effectively in reserve); no card was lost.
- Verified: `npx.cmd tsc -b`, `npm.cmd run lint` (same 3 existing warnings), and `npm.cmd run build`
  pass. Build inside sandbox still hits Vite `EPERM` on `node_modules/.vite-temp`, but succeeds when
  allowed outside the sandbox.

## Changelog - 2026-07-14 (battle result presentation)

- `BattlePanel.tsx`: the province name inside the war-token reward sentence is now always bold and
  uses `PROVINCE_COLORS`, while the rest of the translated sentence keeps the normal text color.
- Battle casualties now show the correct troop icon for Bushi, Shinto, Daimyo, or Monster. The icon
  and numeric count use the defeated clan's color.
- Monster casualty groups append every killed monster name in parentheses beside the numeric count.
  The existing `Battle.killedFigures.monsterNames` data is reused; battle resolution is unchanged.

## Changelog - 2026-07-14 (Generosity, trades, Recruit monsters, Kami flow)

- Generosity is no longer automatic. Its owner chooses a recipient or declines; the recipient then
  accepts/rejects in real time. The coin and Honor are awarded only after acceptance.
- Trades are server-authoritative online, broadcast immediately, and use the local player rather
  than the current-turn player. They can be offered outside War; entering War cancels every pending
  offer and sending or accepting trades remains disabled throughout War and its battles.
- Recruit now displays remaining/total placements. The monster picker uses the Monster icon and
  renders effect tokens such as Daikokuten's Force icon and bold value.
- Recruit monster availability is derived from owned cards actually in reserve, not the obsolete
  `player.monsters` counter. Komainu/Hotei now ask whether to enter the map or pray and consume the
  selected Recruit placement in either case.
- Untagged temple figures are always normal Shinto; the removed legacy heuristic can no longer turn
  a newly placed Shinto into Komainu. The Recruit Shinto control also counts only normal Shinto.
- Fixed online Ryujin monster placement: the client now sends placement to the server before any
  Kami advancement. Ryujin persists the pending monster so reconnecting restores placement instead
  of allowing another card purchase.
- Hotei only replaces an enemy temple figure. Replaced normal Shinto returns to reserve; replaced
  Komainu/Hotei returns as an available monster card. Temple placement logs include the Kami name.
- Amaterasu now always writes a resolution log, including when its winner already leads Honor.
- Verified with `npx.cmd tsc -b`, `npm.cmd run lint` (same 3 existing warnings), a focused rules
  smoke test, and `npm.cmd run build`.
- Runtime note: restart the backend process on port 3001 before online testing; it was started before
  these server changes and cannot hot-reload them.

## Changelog - 2026-07-14 (pending lobby slots)

- Pending online games now expose their complete slot list instead of only already joined players.
- Invited/disconnected players show their username and clan shield in gray with `(Esperando)`.
- Unreserved slots show their clan shield with `Libre/Únete` (`Free/Join` in English).
- Open-slot counts now reflect currently unoccupied capacity and a full lobby no longer remains
  advertised as open.
- Random lobbies assign invited friends a stable random clan at creation, so the waiting-room seal
  matches the clan they receive when joining.
- Verified with `npx.cmd tsc -b`, `npm.cmd run lint` (same 3 existing warnings), and
  `git diff --check`.

## Changelog - 2026-07-14 (live log and War flow polish)

- The live season log no longer truncates to the latest 20 entries. It also combines any setup
  entries already archived for the current season, preserving the complete season from its start.
- Battle bidding opponent badges now include a compact Ronin icon/count; the local player's Ronin
  remains only in the resource header.
- The final battle bidding title adds `(Última Batalla)` / `(Last Battle)`.
- Coin distribution no longer interrupts the battle flow. Normal shares and remainder coins are
  assigned automatically, then the battle result opens immediately. Legacy snapshots with a
  pending distribution also skip the retired popup.
- War summary rows use stable grid columns so province names form a centered column with their text
  aligned left.
- Verified with `npx.cmd tsc -b`, `npm.cmd run lint` (same 3 existing warnings),
  `git diff --check`, and a focused three-player battle smoke test covering automatic remainder
  distribution and preservation of the season-log prefix.

## Changelog - 2026-07-14 (variable force, Recruit undo, Shinto reserve, Jorogumo)

- Map and province tooltips now calculate every variable-force monster consistently: Oni of Skulls,
  Oni of Blood, Daikokuten, Bishamon and Sacred Warrior, including Luna's minimum Force 2.
- Shinto reserve totals no longer double-count Komainu/Hotei while deployed or praying. The normal
  three-piece supply is capped to repair older snapshots inflated by cleanup; owned Shinto monsters
  still add to the effective total and only add to reserve while actually undeployed.
- Cleanup returns only normal, untagged temple Shinto to the physical reserve. Recruit placement
  and its controls use the same corrected available-normal-Shinto count.
- Online Recruit now records its undo snapshot before placing Komainu/Hotei at a shrine, so Undo
  restores the whole Recruit turn instead of being overwritten by the unchanged server state.
- Jorogumo now takes control at the actual start of battle, before War Tactics. Its temporary target
  is persisted through interactive Seppuku/Hostage steps and reverted at battle end if it survives.
  This fixes the recorded Edo battle where Take Hostage removed the only target before Jorogumo ran.
- Focused checks: Bishamon 4, Oni of Blood 4, Oni of Skulls 3, Sacred Warrior 3, Daikokuten 8;
  Komainu praying + Yurei owned reports Shinto 3/4 and Monsters 1/2; the saved Edo state now logs
  Jorogumo taking Yoshikuni's Bushi before hostage selection.

## Changelog - 2026-07-15 (Nure-Onna, ocean Daikaiju, blocking rule notices, Recruit dual types)

- **Nure-Onna** no longer moves automatically at War start. Before each battle, reachable
  Nure-Onna owners are asked in Honor order whether to cross the Sea Route. Accepting moves the
  real figure, adds its owner to battle participants and recalculates contested/uncontested status;
  declining is logged and is remembered for that battle. The decision is server-authoritative and
  survives reconnects. Uncontested battle rewards are now deferred until these decisions finish.
- **Daikaiju in the Ocean**: online monster placement logs the actual monster name instead of the
  generic `Monstruo`. While Daikaiju remains in Ocean, a fixed top-right map button opens a figure
  zoom with its image, owner/clan, Force and translated card effect, matching province diorama data.
- **Path of the Serpent** now appends both post-transfer clan/coin totals to the log. Every charge
  creates a persisted real-time notice: payer and recipient must each acknowledge their tailored
  gain/loss popup; everyone else sees the same transfer details in a waiting state. Multiple
  Serpent charges queue safely.
- **Hotei** logs whether it replaced a normal Shinto or named Shinto-monster and whose figure it
  replaced. A replacement creates a persisted notice for the affected owner; Train/Ryujin flow is
  paused until acknowledgement, while the other players see the event and wait. Recruit placement
  is likewise blocked by the overlay without prematurely ending the Recruit turn.
- The game log recognizes all monster card names and renders them with the Monster icon. New
  `{clanCoins:clanId:amount}` tokens render clan shield + coin icon + colored total.
- Recruit action buttons now keep dual-type cards under **Monster** only. Effective dual-type totals
  remain unchanged in the sidebar reserve. Yurei/Fukurokuju are selected from the Monster popup,
  the Daimyo button counts only the clan Daimyo, and Yurei's `{force}` token renders correctly.
- Verified with focused Nure-Onna accept/reject and Sea Route/Serpent simulations, `npx.cmd tsc -b`,
  `npm.cmd run lint` (only the 2 pre-existing UI warnings), `git diff --check`, and a production
  build. The in-app browser connection failed at its runtime setup; the local Vite server itself is
  running successfully at `http://127.0.0.1:5173` for manual visual testing.

## Changelog - 2026-07-15 (Fujin movement combinations and deferred Serpent charges)

- Fujin's two movement points can now be spent in all supported combinations: two selected figures
  can move together to one adjacent province; one figure can move across a valid two-connection
  route; or the player can perform two separate one-step moves, including moving the same figure
  twice. Selection and server validation both enforce the remaining movement-point cost.
- Sea Route crossings made during Fujin are recorded but do not transfer coins or open Path of the
  Serpent notices while movement is still provisional. Pressing Finish resolves every crossing on
  the server, broadcasts the same notices to all clients, and pauses Kami resolution until both the
  Serpent owner and payer have acknowledged each transfer. The final notice resumes Kami.
- Fujin movement explicitly takes precedence over a stale `marshalMandateActive` flag retained by
  restored/in-progress states. Without this guard, `moveForces` entered Marshal's immediate Sea
  Route charge branch and displayed the Serpent popup before Fujin confirmation.
- Marshal Sea Route crossings are now provisional too. Online clients only buffer the crossing;
  `SKIP_MARSHAL_TURN` replays the confirmed moves server-side, resolves Serpent transfers, and
  broadcasts the shared notices. The next Marshal player/mandate turn is not selected until payer
  and card owner acknowledge every transfer. Hotseat follows the same confirmation boundary.
- Province-diorama figure scales were adjusted to River Dragon 1.30, Jikininki 0.90, Oni of Hate
  1.20 and Bishamon 1.23.
- Verified with focused simulations for two-figure movement, two-connection movement, deferred
  payment and post-confirmation notices; TypeScript, lint (only the 2 pre-existing UI warnings),
  `git diff --check`, and the production build all pass.

## Changelog - 2026-07-15 (Daikaiju placement confirmation)

- Daikaiju placement now has three synchronized stages: owner prompt, map selection and confirmation.
  The owner presses `Colocar en el mapa` to dismiss only their popup and enable province targets;
  other players continue seeing the clan-themed waiting popup.
- Selecting a province moves Daikaiju there server-side and persists the pending province, but does
  not destroy fortresses or start the summary. The owner receives a confirmation popup while the
  other players wait. Only `Confirmar` resolves fortress destruction and opens the shared summary.
- Both owner and waiting popups use the owner's clan border/color, a large Monster icon plus the
  Daikaiju title, and a clan identity row with shield, player name and clan name.
- Hotseat and online share the same selection/confirmation rules. Reconnecting after selection
  restores the confirmation step instead of repeating or prematurely resolving the effect.
- The confirmation popup now includes `Deshacer`. It returns Daikaiju to Ocean without touching
  any fortress, reopens map selection for the owner, and returns the other clients to the waiting
  state. A different province can then be selected and confirmed normally.
- Verified with a focused provisional-selection/confirmation simulation, TypeScript, lint (only
  the 2 pre-existing UI warnings), `git diff --check`, and a production build.

## Changelog - 2026-07-15 (Way of Bushido reward)

- Way of Bushido now awards both resources per Virtue: `2 Coins × Virtues` and `2 VP × Virtues`.
  Previously Coins were hard-coded to 2 while only VP used the Virtue count. A player with no
  Virtues now correctly receives 0 Coins and 0 VP; one Virtue grants 2 Coins and 2 VP.
- The War-start upgrade summary uses the same calculation, so its Coin and VP rows match the actual
  reward. Focused checks cover both zero and one Virtue.

## Changelog - 2026-07-15 (Daikaiju arrival and battle bidding presentation)

- The Daikaiju arrival summary now shows the full figure above a red arrival title containing the
  owner's clan shield and clan-colored name. The destination province is bold, larger and rendered
  in its province color.
- Destroyed fortresses are shown as compact rows with the affected player's clan shield and colored
  name, followed by a clan-colored Fortress icon, bold destroyed count and a correctly pluralized
  `fue destruida!` / `fueron destruidas!` message.
- In online games the arrival summary is broadcast to every player and blocks battle progression
  until everyone accepts. Players who already accepted see `{ready}/{total} listos` plus the waiting
  message while the server collects the remaining acknowledgements.
- The battle bidding header now centers only the local player's VP with a larger icon and number.
  Ronin moved into every combatant badge, including the local player; Koi's displayed value updates
  with the coins still unassigned.
- TypeScript, lint (only the 2 pre-existing UI warnings), and the production build pass.

## Changelog - 2026-07-15 (Ebisu force and Seppuku death trigger)

- Ebisu and every other Monster without a printed Force now respect Luna's minimum Force 2 in both
  the map tooltip and province figure zoom. The province total already used the correct calculation.
- Ebisu's death effect now triggers immediately when sacrificed through Seppuku and grants its owner
  8 Coins before the battle flow advances. Online, hotseat and automatic battle resolution all use
  the same reward, and the resulting Coin total is added to the game log.
- Every Ebisu death now opens a clan-themed synchronized notice for all players. It shows the
  owner's shield/name and the 8-Coin reward in clan color, blocks the underlying battle UI, and only
  closes after every player accepts; accepted clients see the shared `{ready}/{total}` counter.

## Changelog - 2026-07-15 (War resume and Nure-Onna map preview)

- War start acknowledgement is now persisted in game state. Rejoining a saved game after battles
  have started no longer reopens the War Phase start/upgrade popup; legacy snapshots infer this from
  resolved battles, submitted bids, interactive resolution data and other active War steps.
- Nure-Onna's movement decision now includes the same `Ver Mapa` control used by War bidding. It
  temporarily hides the decision without resolving it and provides a `Volver a Nure-Onna` button
  over the map so the owner can inspect routes and forces before accepting or rejecting.

## Changelog - 2026-07-15 (War lobby marker and uncontested battle polish)

- Lobby games currently resolving War now replace the potentially misleading current-player marker
  with a dedicated crimson-and-gold samurai-helmet seal labelled `Guerra`.
- Nure-Onna's source and destination province names use their province colors in both the owner's
  decision and the other players' waiting message.
- Uncontested battle popups consistently render province names in province color. Allied and solo
  winner summaries now align the clan shield and award text as a centered unit with slightly smaller
  typography and balanced spacing above the accept control.

## Changelog - 2026-07-15 (Autumn hostage cleanup)

- The end of Autumn War now skips the hostage-return interaction entirely because Coins have no
  remaining use before final scoring. Figures return without awarding Coins and the game moves
  directly from cleanup to Winter scoring.
- Summer cleanup keeps the existing interactive hostage return and Coin reward. Hotseat, online and
  legacy saved-game paths now follow the same season-specific rule.

## Changelog - 2026-07-15 (Hostages, Jurojin, Oni of Souls and War-start effects)

- Taking a hostage now transfers up to 1 VP from the victim to the captor and records both final VP
  totals. The captured miniature remains unavailable instead of returning immediately to reserve;
  it returns to its owner during cleanup, including the streamlined Autumn and legacy Winter paths.
- Sincerity and Loyalty now apply to the interactive Take Hostage path. A complete Take Hostage
  advantage, including extra rewards, is treated as one Loyalty event.
- Jurojin counts simultaneously as Monster and Virtue in all shared counts, winter scoring and
  Sacred Warrior force. Acquiring any Virtue, including Jurojin itself, grants its owner 3 Coins and
  opens a synchronized notice that every player must accept before Train or Ryujin continues.
- Oni of Souls now grants 2 VP per owned Oni card when its owner wins the contested battle and the
  Oni of Souls remains alive in that province. It counts itself; other Oni only need to be owned.
- Zorro, Way of Naginata, Way of the Ashigaru and Way of the Keiri now use one persistent start-of-War
  queue ordered by the Honor track. The active player's provisional selections are synchronized,
  can be reset or skipped, and only change the map after confirmation.
- Naginata moves one Bushi to any province and respects Luna and Oni of Plagues restrictions.
  Confirmed Sea Route crossings feed the existing Path of the Serpent acknowledgement flow.
- Ashigaru validates exactly one owned figure in the province (Fortresses count only for Tortuga),
  summons up to 2 available Bushi and runs the shared post-Summon upgrade hooks.
- Keiri permits up to 2 enemy Bushi/Shinto targets in every province containing the player's Daimyo,
  Yurei or Fukurokuju, and grants 3 VP per confirmed execution.
- Form of the Fox, Kitsune, Phoenix and Tanuki, Path of the Favored, Way of Bushido and Sacred Warrior
  were aligned with the confirmed rules. Nure-Onna now respects Oni of Plagues.
- `CARD_AUDIT.md` contains the current 85-effect audit and identifies the remaining optional-choice
  flows and cross-card interactions that are still partial.

## Changelog - 2026-07-15 (confirmed card-choice flows)

- Earth Dragon, Fire Dragon and Jorogumo pause before War Tactics and let their owners choose valid
  targets; Earth Dragon may be skipped and all card effects exclude Daimyo-equivalent monsters.
- Benten and Oni of Hate now pause after summon or movement with synchronized owner/waiting UI.
  Benten chooses the rival monster and legal destination; Oni of Hate chooses one valid target per
  higher-Honor rival.
- Sunakake-Baba joins the Honor-ordered start-of-War queue and lets its owner choose or skip its
  hostage target.
- Mercy is no longer automatic. It is offered in normal battle casualties, Fire Dragon, Oni of Hate,
  Way of the Keiri and Path of the Ninja. Keiri allows a separate decision in each province.
- Justice now checks actual deaths and lower Honor in normal battles, Fire Dragon, Keiri and Path of
  the Ninja. Path of the Ninja also has explicit target/skip controls.

## Changelog - 2026-07-15 (Spring card flows and corrected Dignity/Loyalty rules)

- Dignity remains the Spring Virtue that grants 2 VP per copy when a Monster is actually summoned.
  Loyalty is the separate Summer Virtue that grants 1 extra VP per copy and valid VP-gain event
  while allied. Duplicate Loyalty triggers and duplicate Righteousness rewards are now counted.
- Benevolence now triggers only after Coins are actually spent on a Season card (Train/Ryujin) or
  Fortress (Marshal). Its owner chooses a recipient or declines, spent Coins cap duplicate triggers,
  and every successful transfer has an all-player acknowledgement before another copy can resolve.
- Courage and Piety use the same War-token reward path for contested battles, uncontested provinces
  and allied provinces awarded by Force. Piety recognizes normal Shinto, Komainu and Hotei and
  applies every owned copy independently.
- Path of the Builder uses the normal paid Fortress-building controls during any Marshal. Path of
  the Kannushi, Kenin and Light now pause for an explicit source/destination choice or allow their
  owner to decline instead of selecting the first legal target automatically.
- Path of the Vassal now asks after every won Kami shrine whether to pay 2 Coins for 2 VP, supports
  duplicate copies and synchronizes the waiting state online.
- Phoenix awards its own VP and Loyalty as separate events in Seppuku, normal battle and card-effect
  deaths; a captured Phoenix remains unavailable. Righteousness now rewards every own figure death,
  including interactive Seppuku, once per owned copy.
- Jinmenju is confirmed as OK. `CARD_AUDIT.md` now reports 68 complete effects and 17 partial effects.
- TypeScript, the production build and focused card-flow checks pass. Lint retains only the two
  pre-existing UI warnings in FriendsModal and PoliticsTrack.

## Changelog - 2026-07-15 (Summer death effects and synchronized choices)

- Dignity remains unchanged at 2 VP per Monster summon. Loyalty is the separate allied bonus and
  now covers every valid non-Winter VP event without recursively triggering itself; Harvest and a
  complete Take Hostage advantage each remain one reward event.
- Jikininki now observes every effective death in its province from Seppuku, battle casualties and
  card/Monster effects. A simultaneous death still observes every other casualty but not itself;
  Seppuku Honor resolves first, each Jikininki VP can trigger Loyalty, and all players acknowledge
  a notice showing the VP and actual Honor lost.
- Koneko now triggers from the same shared death pipeline, including interactive Seppuku. Its owner
  gains 2 Coins and 2 Ronin, every other clan present loses up to 2 of each, and play is covered by
  an all-player acknowledgement notice.
- Path of the Samurai now queues an explicit province choice after Recruit instead of placing its
  Bushi automatically. Path of the Serpent now asks each owner whether to charge only after the
  movement is confirmed, announces the colored route and final Coin totals, and waits for everyone.
- Patience requires the owner to be strictly below the highest VP total, so a tie at the maximum
  does not qualify. Its reward triggers Loyalty and uses the shared acknowledgement flow.
- Respect supports each additional hostage interactively in hotseat and online play, allows the
  owner to stop after the first capture and applies Loyalty once to the complete Take Hostage event.
- Way of Naginata is complete, including confirm/undo and the optional Serpent decision. Way of the
  Merchant now observes common-supply Coin gains from income, Harvest, Kami and card rewards,
  including Koneko and Ebisu, while ignoring transfers and deals.
- Trade proposals can include an optional message of at most 250 characters, synchronized online.
- `CARD_AUDIT.md` reflects the completed Summer flows and the remaining genuine partial effects.
- TypeScript and the production build pass. Lint retains only the two pre-existing warnings in
  FriendsModal and PoliticsTrack. No development or game server was started.

## Changelog - 2026-07-15 (complete card audit: 85/85)

- Path of the Monkey now pauses after Summon, allows its owner to decline, and offers every opponent
  tied for the greatest Coin total. Duplicate copies resolve independently. This also completes the
  post-Summon flow for Way of the Ashigaru.
- Kitsune rewards the winner of a War Province token in contested, uncontested and allied provinces,
  but only after casualties have resolved and only while Kitsune remains alive in that Province.
- Benten, Oni of Hate and Oni of Spite now trigger when they enter through a Betray replacement as
  well as Summon and movement. A two-step Fujin move evaluates the intermediate and final Province
  separately, pausing the continuation when an interactive entry effect must be resolved.
- Path of the Unrighteous preserves the normal different-owner restriction for the first two Betray
  replacements. Every owned copy adds one unrestricted replacement and can replace an opponent's
  worshipping Shinto in the same shrine; the displaced normal or dual Monster/Shinto returns to its
  proper reserve. Online Betray now transmits the chosen replacement Monster and cannot duplicate a
  Monster that is currently worshipping.
- Way of the Snake asks every owner, in Honor order, whether to perform Betray after the Kami Turn.
  Multiple owners resolve sequentially, declining is valid, other players wait, and the original
  next-player index plus Kami summary are restored after the final decision.
- `CARD_AUDIT.md` now reports 85 of 85 unique effects as `OK`, with no remaining `PARCIAL`, `FALTA`
  or `DUDA` rows. Focused checks cover Monkey ties, worshipping Shinto replacement, multiple Snake
  owners, living/dead Kitsune and Oni of Spite on both Fujin steps.
- TypeScript, focused card-flow checks and the production build pass. Lint retains only the two
  pre-existing warnings in FriendsModal and PoliticsTrack. No server was started.

## Changelog - 2026-07-15 (Jurojin self-trigger correction)

- Jurojin still counts simultaneously as a Monster and a Virtue for scoring, force and card counts,
  but acquiring Jurojin itself no longer grants its 3-Coin reward or opens its acknowledgement.
- Only acquiring another Virtue triggers Jurojin, matching the card text. Focused Train and Ryujin
  checks confirm that self-purchase does nothing while a subsequent Virtue grants exactly 3 Coins.

## Changelog - 2026-07-16 (online Train purchase recovery)

- Fixed an online Train failure where confirming a purchase could permanently lock the Season-card
  market if the WebSocket was no longer open or the server rejected the action without replying.
- Online purchases are now locally validated before dispatch but remain server-authoritative. A
  closed connection leaves the market interactive and shows a retry message instead of mutating the
  online game locally.
- The server now reports invalid card, wrong-player and pending-Monster purchase rejections. The
  market also has a six-second recovery fallback, while successful purchases unlock immediately as
  soon as the bought card disappears from the shared deck (including Benevolence follow-up flows).
- The saved affected game still had Benevolence in the deck and Sol as the active Train buyer, so no
  card, Coin or turn data was lost by the failed attempt. The production build passes.

## Changelog - 2026-07-16 (legacy Jurojin placement recovery)

- The repeated Benevolence rejection was traced to the affected snapshot, not to Benevolence: an
  older self-triggering Jurojin notice advanced Train from Granvi to Noboru before Jurojin was ever
  placed, while leaving `pendingMonsterPlacementCardId=sp-jurojin` behind.
- Resume now removes that specific invalid self-reward notice, log entry and 3 Coins while preserving
  Jurojin as an unfinished placement. Granvi receives the normal placement UI after reconnecting.
- A restored Monster placement may now be completed by its authenticated owner even when Train has
  already moved to the next buyer. Completing it does not increment Train a second time, so Noboru
  remains the current Sol buyer and can then purchase Benevolence normally.
- The current snapshot was verified to contain no Jurojin figure on the map or in a shrine, with
  pending order index 2 and current Train index 3. The production build passes.

## Changelog - 2026-07-16 (Path of the Light board-selection UI)

- Path of the Light no longer uses a shrine `<select>`. Its owner receives a balanced informational
  popup with the clan seal/name, Shinto icon, rule summary, and `Omitir` / `Elegir santuario` actions.
- Choosing a shrine closes the popup and highlights every shrine with available capacity. Clicking
  one renders a provisional clan-colored Shinto directly on that shrine without advancing the
  synchronized game state.
- A compact bottom toolbar shows the selected Kami shrine, an icon-only Undo action and Confirm.
  Undo removes the provisional Shinto and allows another shrine; Confirm performs the authoritative
  placement. Other online players retain the existing synchronized waiting popup throughout.
- The server resolves the placement using the authenticated connection identity. Production build
  and lint pass; lint retains only the two pre-existing FriendsModal and PoliticsTrack warnings.

## Changelog - 2026-07-16 (pause Kami until Recruit-end placements finish)

- Fixed the Kami phase-start popup appearing above Path of the Light while its shrine selection was
  still pending. Kami may be precomputed at the end of Recruit, but its popup is now suppressed until
  the complete `pendingSpringPlacement` queue has been resolved or skipped.
- Entering Path of the Light shrine-selection mode also closes any stale Kami popup already visible.
  Online state synchronization actively clears that overlap, and GameBoard has a final render guard.
- The server rejects `KAMI_PHASE_READY` while a Recruit-end placement remains unresolved, preventing
  clients from starting Kami early even if they send a stale ready action.
- Hotseat resolution now invokes the same deferred Kami-popup detector after the final placement.
  The affected saved snapshot was tested directly: before confirmation Light remains pending and Kami
  inactive; after confirmation one Shinto is placed, Light clears and Kami becomes eligible to open.
- Production build and lint pass; lint retains only the two pre-existing warnings.

## Changelog - 2026-07-16 (refresh Kami shrines after Path of the Light)

- Fixed Kami using the shrine queue computed before Path of the Light. An initially empty shrine
  could be marked as skipped and remain absent even after the upgrade placed a Shinto there.
- After the final Recruit-end placement resolves, the complete Kami queue is rebuilt from the final
  shrine board in left-to-right order. Forces are recalculated, the first winner is refreshed and
  any now-invalid `sin figuras, saltado` entry from the current Kami turn is removed.
- `KAMI_PHASE_READY` performs the same refresh defensively, repairing intermediate saved snapshots
  that already contain the Shinto but still carry the old queue.
- Snapshot 41/42 regression checks now produce Fujin as shrine 1, Yoshikuni/Zorro as its winner with
  Force 1, followed by Ryujin, Hachiman and Susanoo. Production build and lint pass.
- The already completed Kami turn in the active test game is not retroactively replayed because its
  later rewards have already been applied; doing so would resolve Fujin out of order or duplicate
  Ryujin/Hachiman/Susanoo effects.

## Changelog - 2026-07-19 (admin diorama figure calibration)

- The admin Diorama now keeps the Nagato province composition full-size while its figure catalogue
  and line editor float above it as independent draggable panels. Both panels can be collapsed and
  retain their dragged position while the tool remains open.
- Every catalogue entry displays its effective game scale. Occupied line slots show the same value
  and accept signed percentage adjustments such as `+25` or `-25`; applying one updates every
  instance of that figure in the Diorama immediately.
- Figure scales were moved out of `RegionDetailModal` into a shared utility, so the province Diorama,
  figure zoom and admin calibration tool all resolve the same values.
- Custom scales are global application settings persisted in SQLite. All clients load them on app
  start, while the write endpoint requires an authenticated administrator and validates scales
  between 0.2 and 3.
- TypeScript, lint and the production build pass. Lint retains only the two pre-existing warnings in
  FriendsModal and PoliticsTrack. The integrated visual browser was unavailable due to an internal
  Codex browser-runtime path error; no development or game server remains running.

## Changelog - 2026-07-19 (admin diorama viewport size)

- The admin Diorama outer window now uses the same `1300 x 1024` dimensions, `90vh` height limit and
  corner radius as the in-game Province Diorama instead of expanding up to 96vw and 1800px.
- Floating and collapsible calibration panels continue to render above the unchanged Nagato stage.
- The production build passes.

## Changelog - 2026-07-19 (screen-wide panels and province line offsets)

- The admin figure catalogue and line editor now live directly on the full-screen Diorama backdrop
  rather than inside the Nagato window, so they can be dragged anywhere on the global screen without
  being clipped by the province frame.
- Admin figures now use the Province Diorama's exact per-slot vertical offsets, the special
  three-figure front-line spacing, the 27px middle-line gap and the fixed 345/255/160px line heights.
- The redundant Nagato province title was removed from the admin calibration view.
- TypeScript, lint and the production build pass. Lint retains only the two pre-existing warnings.

## Changelog - 2026-07-20 (Sol tooltip and troop glow)

- The Sol clan tooltip now presents its tie reward over three fixed lines with the real Honor, Coin
  and VP icons, explicitly showing the winner's +1 Coin/+1 VP and the loser's -1 Coin/-1 VP.
- The former animated golden Sol glow was restored to every Sol figure icon on Province cards while
  preserving the common dark drop shadow used by all figures.
- Four vector Bushi icon alternatives were prepared at 64px, 32px and 20px in
  `design/bushi-icon-proposals.svg` and its rendered PNG. The current game icon remains unchanged
  until one proposal is selected.
- TypeScript, lint and the production build pass. Lint retains only the two pre-existing warnings.

## Design pending - 2026-07-20 (angular Bushi icon)

- The first four crossed-weapon proposals were rejected for looking too rounded and insufficiently
  like katanas.
- `design/bushi-icon-proposals-v2.svg` and its PNG develop the preferred Bushi-silhouette direction
  into four angular variants: high guard, horizontal cut, frontal guard and charge.
- Each variant uses a geometric kabuto/body plus a separately outlined single-edged katana with a
  visible tsuba and handle, previewed at 64px, 32px and 20px.
- No in-game icon has been changed yet; the next step depends on selecting or refining C1-C4.

## Changelog - 2026-07-20 (Bushi C1 icon selected)

- The former crossed-swords Bushi icon was replaced globally with the selected C1 high-guard Bushi:
  an angular kabuto, geometric warrior silhouette and raised single-edged katana.
- The final katana is thicker than the proposal at the blade, tsuba and handle, with a dark outline
  so it remains distinct from the warrior and readable in every clan color at 14-21px.
- The C1 design preview was updated to match the implemented icon.
- TypeScript, lint and the production build pass. Lint retains only the two pre-existing warnings.

## Changelog - 2026-07-20 (fortresses in admin Diorama)

- Every clan row in the admin Diorama catalogue now includes its real Fortress miniature alongside
  Bushi, Shinto and Daimyo.
- Fortresses can be placed in any Diorama line, removed from occupied slots and calibrated with the
  same signed percentage control. Their saved keys are clan-specific (`fortress-<clanId>`), so the
  resulting scale also applies to the in-game Province Diorama and figure zoom.
- TypeScript, lint and the production build pass. Lint retains only the two pre-existing warnings.

## Changelog - 2026-07-20 (Earth Dragon pre-battle and battle UI)

- Earth Dragon now resolves after every player accepts the battle introduction and before any War
  Tactics bids are submitted. Moving the selected figures recalculates the province participants;
  if the move leaves no opposition, the battle is reclassified and awarded without opening bids.
- Its decision UI uses clan-bordered figure choices and province-colored destination choices instead
  of native selects. The owner can inspect the map and return without losing the current selection.
- Take Hostage, Hire Ronin and Imperial Poets are displayed as Tomar Rehén, Contratar Ronin and
  Poetas Imperiales in both bidding and result summaries; Seppuku remains unchanged.
- The clan-power tooltip is now shared by the left player panel and every Honor Track entry.
- Battle coin reparations remain automatically divided, including deterministic remainder coins, but
  now pause on an all-player informational popup listing the exact amount received by each loser.
- TypeScript and lint pass. The production build passes with Vite's runner config loader; the default
  config bundler was blocked by Windows from writing its temporary file under `node_modules`.
- Focused logic checks cover Earth Dragon converting a contested battle to uncontested before bids
  and a five-coin reparation split reported as three and two coins.

## Changelog - 2026-07-20 (clan tooltip wording)

- The Sol clan power now reads `empate por [Honor]`, making the tiebreak condition explicit.
- The Libelula clan power includes the Monster icon alongside Bushi, Shinto and Daimyo because its
  Monsters can also be summoned and moved to any Province.
- The Zorro clan power now says `coloca un [Bushi] gratis` instead of placing a numeric `1` after
  the figure icon.

## Changelog - 2026-07-20 (Tea Ceremony ready feedback)

- In online season setup, accepting the Tea Ceremony popup now keeps that popup visible and replaces
  its button with the standard `ready/total listos` counter plus an `Esperando al resto` message.
- The duplicate ready counter was removed from the right Action panel, keeping the multiplayer
  acknowledgement feedback in the same place as the rest of the game's shared popups.

## Changelog - 2026-07-20 (Luna and Loto clan tooltips)

- Luna's power is now presented on two fixed lines: all figures have Force 2, followed by the shared
  maximum of two figures per Province or Shrine.
- Loto's power now describes hiding a selected Political Mandate face down and declaring the Mandate
  resolved in its place. `Mandato Politico` is bold and rendered in the clan color.

## Changelog - 2026-07-20 (Justice text and Benevolence honor log)

- Justice now reads `Gana 3 [VP] cada vez que mates 1 o mas figuras de un jugador con menos
  [Honor]`, with the bold amount placed before the VP icon.
- Benevolence logs use Coin and Honor icon tokens and include the owner's final Honor Track position
  immediately after the Honor gain.

## Changelog - 2026-07-20 (shared clan powers on home)

- The home clan previews no longer use their own stale plain-text power table.
- Home, Player sidebar and Honor Track now render the same shared clan-power content, including the
  current wording, figure/resource icons, line structure and clan-colored emphasis.

## Changelog - 2026-07-22 (Kami Unbound alpha and production packaging)

- Added the optional Kami Unbound expansion to both hotseat and online game creation. The four
  selected Kami start each season off-board; after resolving each Shrine, its top worshipper chooses
  any Province, previews the destination and confirms manifestation or relocation. Rejoining resumes
  the persisted choice.
- Until the final miniatures arrive, every Kami uses `template_fig.png` with the Kami name below it
  in map tooltips, Province Diorama and figure zoom.
- Implemented all seven leaflet powers: Amaterasu death protection, Tsukuyomi's pre-battle Coins,
  Susanoo's movement lock, Raijin's Force restriction, Fujin's Harvest/War rewards, Ryujin's variable
  card-type Force (including Jurojin as Monster and Virtue), and Hachiman's doubled Ronin Force.
- Kami are 1 Force clan figures controlled by the current top worshipper, change controller after
  Shrine or Honor changes, move normally, cannot be killed, captured, Betrayed or selected by card
  effects, and return off-board during seasonal cleanup.
- Added `npm run check:kami`; its focused rules checks pass. TypeScript and the production Vite build
  pass, and a production smoke test returned HTTP 200 for both `/api/health` and the SPA root.
- Production packaging now includes Docker, same-origin HTTPS/WebSocket defaults, strict production
  JWT configuration, CORS allowlisting, health checks, persistent database/backup mounts and static
  SPA serving. The container binds only to Droplet loopback port 3002 to coexist with n8n.
- Added a safe database preparation command. `deployment-data/games.db` was generated from the local
  database with only admin `Yoshikuni`, no other users and no games; `data/games.db` was not modified.
- Proposed production URL: `https://shogun.thehappysamurai.com`. Deployment still needs DNS access,
  SSH access to the Droplet, and inspection of its existing Docker/reverse-proxy layout before making
  any server changes.

## Changelog - 2026-07-22 (Kami information, live Shrine resolution and clan translations)

- Clicking a Shrine with Kami Unbound enabled now shows the temporary Kami figure and its Province
  power alongside the base Shrine reward. The manifestation popup shows the same power and has more
  breathing room between its explanatory text and action button.
- Manifested Kami use the `神` divinity kanji as their compact map icon.
- Shrine force and winner data are rebuilt from the live board when each Shrine becomes current and
  again immediately before its reward. A Komainu or Hotei placed in a later Shrine during Ryujin can
  therefore change that later result correctly; the focused Kami check covers this regression.
- Shared clan-power tooltips are fully bilingual. Home clan previews use the same icon-rich content,
  fixed-line presentation and header treatment as the in-game sidebar and Honor Track tooltips.
- `npm run lint`, `npm run check:kami` and the production build pass. Lint retains only the two
  pre-existing warnings in FriendsModal and PoliticsTrack.

## Changelog - 2026-07-22 (clan tooltip layout refinement)

- Clan power text is centered consistently on the home, player sidebar and Honor Track.
- Koi uses stable centered lines with no stray punctuation and keeps the Force icon beside
  `Monedas suman`; Tortuga and Libelula use intentional two-line layouts.
- The Loto home tooltip has a wider clan-specific layout so both fixed power lines remain inside
  its border.
- Removed the legacy 220px home power-column limit so power text is centered against the complete
  tooltip width. Bonsai no longer ends in a period, and Zorro uses two intentional lines with
  `gratis` on the first and `figuras.` on the second.

## Changelog - 2026-07-22 (Kami placement retention and legend)

- A manifested Kami can now be confirmed without selecting another Province, keeping it in its
  current location. First manifestation still requires a destination, and the toolbar identifies
  the retained Province before confirmation.
- Added the `神` Kami figure symbol to every icon legend in Spanish and English.
- The focused Kami checks cover retaining an existing Kami without a new Province selection.

## Changelog - 2026-07-23 (Train market navigation and Benevolence priority)

- During Train, the market now includes `Ver mis cartas`; the owned-card view provides
  `Volver a la compra`, and closing the market exposes the same explicit return action on the
  Politics Track while that player still has a pending purchase.
- Buying a card keeps the market locked until the authoritative update arrives. Benevolence,
  monster placement and rule notices close the market and take visual priority; the game logic
  also rejects any duplicate purchase while one of those follow-up flows remains unresolved.
- Benevolence now raises the existing board Alliance Track beside Honor instead of rendering a
  duplicate track inside its popup.
- Added `npm run check:train` to cover the duplicate-purchase guard during a pending Benevolence
  decision.

## Changelog - 2026-07-23 (Loto final-mandate sidebar flow)

- Entering Loto's `Sustituir por` step no longer looks like an idle Politics turn, so dismissing
  a turn popup cannot trigger a second draw of four mandate tiles.
- Mandate draws are rejected in both shared game logic and the online server whenever a draw,
  Loto replacement, mandate resolution or Kami transition is already active.
- Choosing Loto's actual mandate clears stale drawn tiles defensively. The sidebar also hides
  mandate-choice lists during an active resolution, repairing the visual symptom in older saves.
- Added `npm run check:loto` covering the seventh-mandate replacement flow, duplicate-draw
  rejection and cleanup of a previously corrupted state.

## Changelog - 2026-07-23 (online Fujin undo synchronization)

- Fujin undo is now authoritative in online games: the server stores the last valid pre-move
  state, restores it on `FUJIN_UNDO` and broadcasts the restored board to every player.
- The client no longer restores only its private copy of the board. This fixes subsequent moves
  being silently rejected because the client and server disagreed about a figure's origin.
- Online Fujin moves are preview-validated before being sent, so an invalid move cannot enable a
  misleading Undo action. Confirming Fujin clears the server snapshot. The focused Kami checks
  cover Luna moving again from the restored origin after Undo.

## Changelog - 2026-07-23 (Ryujin private purchase flow)

- Ryujin's Season Card market now opens only for the Shrine winner in online games. Every other
  player receives a blocking waiting popup naming the resolving player.
- Client controls, shared game logic and the online server all verify the Ryujin winner before
  allowing Buy or Skip, preventing observers or stale windows from submitting a purchase.
- Ryujin now shares Train's card navigation: `Ver mis cartas`, `Volver a la compra`, backdrop/X
  closing and the persistent return-to-purchase action while the reward remains unresolved.

## Changelog - 2026-07-23 (pre-battle ordering, hidden totals and war UI)

- Earth Dragon, Fire Dragon and Jorogumo now resolve completely before War Tactics open. Multiple
  effects are queued by Honor and each decision blocks bidding until the pre-battle sequence ends.
- Fire Dragon deaths and Koneko resource changes therefore happen before players commit coins.
  War bids reject negative or malformed amounts, and submitting zero bids repairs a legacy negative
  balance to zero so affected saved games can continue.
- Koneko shows each actual loss but reveals a player's remaining Coins only when they could not pay
  the full two-coin loss, in which case the popup justifies the shortfall with a zero balance.
- The live War log hides resource/VP totals from the start of War until all battles resolve, then
  restores the original complete entries for the finished season.
- Home now includes the complete icon legend. Ryujin waiting and the active bidder use larger clan
  seals, and the War start popup uses the same samurai helmet seal as the lobby.
- Added `npm run check:war` for pre-battle Fire Dragon/Koneko ordering, negative-balance recovery and
  rejection of negative bids.

## Changelog - 2026-07-23 (final battle distribution and Respect summary)

- The last unresolved battle of a War still performs the internal coin transfer but skips the
  now-irrelevant distribution popup and proceeds directly to the battle result.
- Battle results render every hostage captured through Respect instead of only the legacy singular
  hostage field, so both figure names and owners remain visible.
- Camino de la Serpiente uses the shared decision-question spacing, keeping its text clear of the
  charge/decline buttons.

## Changelog - 2026-07-23 (complete end-game log)

- The final game screen now includes `Ver Log`, opening a large, scrollable modal with tabs for
  Spring, Summer, Autumn and Winter.
- Spring, Summer and Autumn reuse the game's rich log rendering, including clan/province colors,
  icons and private entries visible to the appropriate players. Autumn is separated from the
  Winter scoring lines that remain in the active log when the game ends.
- Winter shows only the final scoring breakdown for each player: Province tokens by season,
  different-Province set bonus, each Winter scoring card and the total VP gained in Winter.
- Added complete Spanish and English labels and responsive styling for the final log modal.
