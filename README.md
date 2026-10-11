# Aetherheim Tales — fan-made 3D browser MMORPG

An original single-player game inspired by the 2013 anime-style web MMORPG *Alfheim Tales Online*, built with Three.js. Not affiliated with the original game.
Every model, texture, icon and sound is generated in code; no assets from the original game are used.

## Play

**https://codecapsule.github.io/aetherheim-tales/** — runs in any modern desktop or mobile browser, no install or account needed.

Progress is saved in your browser (local storage), so it stays on the device and browser you play on.

To run it yourself, serve this folder with any static web server:

```sh
npx http-server . -p 8080   # then visit http://localhost:8080
```

Three.js loads from jsDelivr, so the first load needs an internet connection.

## What's in it

- **World of Carlyle**: Sylvan Haven town with the four Spirit shrines and fountain, Breezy Meadow, Mossveil Forest,
  the Elder Ruins with a boss arena, a river with bridges, floating islands and the World Tree on the horizon.
- **A world four times larger, up to Lv 200**: the map is 800 x 800 m with eight outer zones around the starter areas:
  Sunpetal Plains (Lv 16-30), Whispering Marsh (30-50), Ember Canyon (50-80), Frostpeak Highlands (80-110), Crystal Wilds
  (110-140), Shadow Fen (140-170), Starfall Plateau (170-200) and the Yggdrasil Gate (190-200). Each has its own biome,
  about five new monster types, elites, a field boss and an outpost camp with a merchant and a teleport point. The level
  cap is 200, and monster HP grows faster than their damage, so high-level monsters take far longer to kill.
- **4 classes, each tied to one of the four elements**: Knight (Earth), Assassin (Wind), Mage (Fire) and Priest (Water). Each class has 6 skills and a dual talent.
- **Story chapter**: 11 quests with NPC dialogs, auto-pathing from the quest tracker, kill and collect objectives and
  the Treant King Yggr boss with telegraphed red-circle attacks. Repeatable bounties follow.
- **Pets, sprites, mounts and wings**: 27 collectible pets that fight beside you (up to Lv 60), 4 elemental sprites,
  13 mounts and fairy wings. New pets and mounts drop from the new monsters and bosses or are sold by Mimi and Brom.
- **Costumes**: 23 cosmetic outfits, hats and wings in the Wardrobe (V). They change only your look, never your stats.
  Buy them at Coco's Boutique or find them in Wardrobe Boxes.
- **Dungeons**: eleven instanced dungeons with their own entrances in the world, from Mossy Hollow (Lv 6) to the
  Throne of Yggdrasil, where Fenrir, the World Devourer waits as the Lv 200 boss. Clear each chamber to break the rune
  seal ahead, then fight a boss with telegraphed attacks (slams, novas, root bursts, dragon breath, summons). Dungeons
  are hard: monsters inside are tougher than in the field, a run fails after 15 minutes or a fourth death, and bosses go
  berserk after 4 minutes. Runs are rated S/A/B; the rating sets the size of the treasure chest.
- **Relic collections and Red gear**: every dungeon hides four collection relics (crown, seal, idol and tome) dropped by
  its monsters and chest. Completing a set gives a permanent Attack and HP bonus. Four relics of one dungeon, a Crimson
  Core, Star Essence and gold forge a **Red** item at the Crimson Forge: the new top rarity, with four affixes, a
  legendary power and three gem sockets.
- **Loot**: gear drops on the ground with a light beam in its rarity color across six tiers: Common, Uncommon, Rare,
  Special, Unique and Legendary. Rare and better items roll bonus affixes (lifesteal, crit damage, cooldowns, thorns and
  more). Unique and Legendary items are named and carry a special power, such as chain lightning, meteor strikes every
  6th hit, phoenix rebirth or a healing nova. Loot auto-collects (toggle in Settings).
- **Daily and weekly missions**: a fresh set of daily missions every day and weekly missions every Monday (00:00 UTC),
  tracked automatically. Missions cover kills, dungeons, crafting, trading, donations, world bosses and guild wars. Claimed
  missions fill an activity bar with treasure chests (daily 20/40/60/80/100, weekly 150/300/450/600).
- **Guilds and guild wars**: join one of five guilds or found your own (recruits arrive while you play). Daily gold,
  material and diamond donations level the guild (up to Lv 10) for a permanent Guild Blessing (+Attack, +Max HP) and
  earn Contribution for the guild shop. **Guild Wars** (Lv 10+, two a day) are
  4-minute battles in the Spirit Crystal Arena: lead four guildmates against a rival guild, destroy their crystal and
  defend yours.
- **World bosses**: every 15 minutes a world boss descends on the Storm Altar north-east of Breezy Meadow (the
  Thunderhoof Behemoth, or a festival boss such as the Pumpkin King). Bring it down before it retreats: rewards depend on
  how fast you win, counted from your first hit, and the boss keeps its wounds if you fall and come back.
- **Trading and crafting**: monsters drop materials and gems into a separate pouch. Gorm's Forge crafts potions, tickets,
  pet eggs, gem pouches and Rare to Unique gear (with a Masterwork chance). The Market lists merchant goods at prices that
  drift through the day; list your own items and they sell over time (cheaper sells faster, 5% tax).
- **Enhancement +1 to +15**: the Forge's Enhance tab levels up any piece of gear with Enhancement Stones (normal for
  +1 to +5, Greater to +10, Divine to +15) and gold. Success drops from 100% to 12% at +15; each failure adds +5% to the
  next try (up to +25%), and from +7 a failure drops the item one level unless a Protection Charm is used. Lucky Charms
  add +15%. Base stats grow 7% per level with bonus steps at +5, +10 and +15 (x2.6 at +15), affixes grow from +10, and
  enhanced weapons glow blue (+7), violet (+10) and blazing (+15). Stones drop from monsters and dungeon chests, are sold
  by Hilda and refine 5 into 1 of the next tier.
- **Gems with unique stats**: besides Ruby, Sapphire, Emerald and Topaz, eight Arcane gems carry the rare stats
  (Amethyst crit damage, Onyx lifesteal, Opal cooldowns, Aquamarine speed, Garnet thorns, Jade regeneration, Moonstone
  EXP, Citrine gold find). Every gem combines 3 into 1 up to the fifth level (Celestial). **Soulstones** socket like gems
  (one per item) and grant a named power: the twelve Unique/Legendary powers plus three found only on Soulstones (Twin
  Fang, Executioner, Giant Slayer). The Socket Drill adds up to two extra sockets (five in total) and the Soul Forge fuses
  three Brilliant gems into a random Soulstone.
- **Equipment progression**: gear can also be reforged (reroll affixes), re-tempered to your level,
  ascended up a rarity tier (Special gear awakens into a named Unique, Unique into a Legendary) and salvaged into Spirit
  Dust, Shards and Star Essence. The Legendary Codex tracks all 21 named items, grants a collection bonus and pays out at milestones.
- **Game Master Console**: in the claude.ai version the server list on the title screen has a Game Master Console link for
  the artifact's owner and editors (on this website it only opens on a local copy or with `#admin`, and shows only your own save). In the published version the game reports each signed-in player's status to the
  artifact's shared database, and the console shows players online, levels, classes, zones, gear, play time, an
  activity feed (level ups, dungeon clears, deaths, rare loot), client errors and the server clock. From it the owner can
  post an announcement, start an EXP/Gold event, show a maintenance notice and send gifts to everyone or to one player.
  Players with view-only access cannot report, so share the game as Contributor to see them.
- **Play together (real time)**: on the website, everyone who picks the same server on the title screen shares one
  world. You see each other walk, ride and wear costumes, your chat reaches everyone on the server, and the **Online**
  panel lists who is on with a Go to button that teleports you next to a friend. Monsters, loot and progress stay
  separate for each player, and a player inside a dungeon or guild war is hidden until they come back. It runs on a free
  Supabase Realtime channel (broadcast and presence, no database tables): put the project URL and its **publishable**
  key in `js/mp-config.js`. With no key, or inside the claude.ai page, the game plays solo as before.
- **Parties**: click another player and press **Invite** (or use the Online panel) to team up, up to 4 players.
  Party members within 60 m of a kill share its EXP: the kill's EXP is split between everyone nearby, plus 10% per extra
  member, and each member's own level penalty and EXP boosts apply to their share. The party frame under your wallet
  shows members' levels and HP (dimmed when too far to share), `/p message` or the Party chat tab talks to the party,
  the earliest member leads and can remove players, and reloading the page keeps you in your party.
- **Seasons, festivals and leaderboards**: each month is a season with a 30-tier Season Pass (free and premium tracks)
  and a Season leaderboard that pays out when the month ends. Leaderboards also rank Battle Rating, Level, World Boss
  damage, dungeon speed, guild war wins and guilds. Festivals follow the calendar: the Harvest Moon (October to early
  November) brings Jackpuffs, the Pumpkin King, Moon Candy, pumpkin decorations in town and a festival shop with the
  Pumpkin Pip pet, orange fairy wings and a title. Winter Starlight (December) and Sakura Bloom (spring) work the same way.
- **Professions**: Mining, Herbalism and Logging at ore veins, herbs and trees in every zone (five tiers, each
  needing a higher skill level); Farming on eight plots at the homestead west of town, where seven crops grow in real
  time (water and fertilize to speed them up); Alchemy turns herbs and produce into stronger potions and timed elixirs
  (Might, Iron Skin, Swiftness, Wisdom, Fortune, Phoenix Draught); Smithing turns ore and logs into gear and Crimson
  Cores. Each profession levels to 100.
- **Shops, auction and trading**: new NPCs in town run shops: Hilda (supplies, bag scrolls), Tilly (seeds), Vera
  (alchemy), Opal (gems), Coco (costumes), Elias (relics and Crimson Cores), plus pet and stable shops and a trader at
  every outpost. Grimsby runs the **Auction House**: real-time lots with bidding, buyouts and rival bids, and your
  own auctions.
- **Bag**: 48 slots, expandable to 160 with Bag Expansion Scrolls, gold or diamonds. **Sell All** sells everything up to
  a chosen rarity in one go; locked gear is always kept.
- **MMO systems**: Battle Rating, bag, skill upgrades, auto battle, auto potions, titles, daily sign-in, online gifts,
  a gold/diamond mall, world and guild chat, minimap and world map.
- **Phones and tablets**: on small screens the HUD docks to a bar along the bottom (Events, Hero, Bag, Skills, Quests,
  Chat, More). Events and More open as sheets above the dock that close when you pick something or tap the game; a red
  dot marks a sheet with something waiting. The skill bar sits above the dock with Auto and Mount beside it, and the
  layout also works in landscape.
- **Icons**: every icon is a hand-made SVG in `js/icons/`, so nothing depends on the device's emoji font.

## Controls

| Action | Input |
| --- | --- |
| Move / attack / talk | Click (or tap) the ground, a monster or an NPC; WASD also moves |
| Camera | Drag to rotate, scroll or pinch to zoom |
| Skills | 1–6 |
| Potions | Q (HP), E (MP) |
| Mount / Auto battle | R / T |
| Panels | C character, B bag, K skills, P pets, U mounts, Z professions, V wardrobe, L quests, M map, O settings |
| Live systems | H missions, G guild, N market, Y forge, X codex, J season pass |
| Other | Space jump, Tab next target, F talk, Enter chat, Esc close |

Progress saves to the browser's local storage. Daily and weekly resets, world boss times and seasons follow the real clock (UTC).
The only other players in the world are real ones on your server (see Play together). Guildmates, guild war rivals,
market buyers and auction bids are simulated, so those systems also work solo.

## Code layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Classes, skills, monsters, pets, mounts, quests and other tables |
| `js/data-world.js` | Expanded world content: outer zones, Lv 16-200 monsters, dungeons 4-11, relics, professions, crops, recipes, costumes, shops |
| `js/life.js` | Gathering nodes, farming, alchemy, smithing, elixirs, costumes, relic collection and Red gear |
| `js/economy.js` | Bag expansion, Sell All, NPC shops and the Auction House |
| `js/upgrade.js` | Enhancement +1 to +15, arcane gems, Soulstones, Socket Drill and Soul Forge |
| `js/live.js` | Live link to the artifact's shared database: player status, announcements, events, gifts |
| `js/admin.js` | Game Master Console |
| `js/mp.js`, `js/mp-config.js` | Real-time multiplayer over Supabase Realtime: other players, chat, Online panel |
| `js/party.js` | Parties: invitations, party frame and chat, shared EXP |
| `js/models-monsters.js`, `js/models-extra.js` | New monsters and bosses; new pets, mounts, gathering nodes and crops |
| `js/toon.js` | Cel-shaded materials, ink outlines and canvas textures |
| `js/models.js` | Procedural chibi characters, monsters, pets, mounts and sprites |
| `js/world.js` | Terrain, town, scenery batching, collision grid and A* pathfinding |
| `js/fx.js` | Particles, skill effects, projectiles, telegraphs and combat text |
| `js/game.js` | Game state, combat, AI, quests, inventory, loot drops, dungeon runs and saving |
| `js/systems.js` | Missions, guilds, guild wars, world bosses, materials, crafting, market, gear upgrades, codex, festivals, season pass and leaderboards |
| `js/systems-data.js` | Tables for the systems above (missions, recipes, guilds, market goods, festivals, season rewards) |
| `js/models-event.js` | World bosses, festival monsters and pets, guild war crystals |
| `js/loot.js` | Rarity tiers, affixes, named Unique/Legendary items and loot rolls |
| `js/dungeon.js` | Dungeon and guild-war arena environments, rune seals, chests, exit portals and overworld entrances |
| `js/models-dungeon.js` | Dungeon monsters and bosses |
| `js/nav.js` | Walkability grid and A* pathfinding shared by the world and dungeons |
| `js/icons.js`, `js/icons/*.js` | SVG icon set (skills, UI, items) |
| `js/ui.js` | HUD, panels, dialogs, chat, minimap and world map |
| `js/ui-systems.js` | Panels and HUD widgets for the live systems |
| `js/ui-life.js` | Professions, farm, Crimson Forge, collection, wardrobe, shop, auction and Online panels |
| `js/main.js` | Boot, title screen, character creation and main loop |
