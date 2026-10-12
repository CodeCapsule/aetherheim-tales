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
- **Heroes in a chunky toy style**: players and townsfolk are built from rounded, soft-shaded blocks (big heads, short
  bodies, bright gear), like the KayKit Adventurers pack. Every class wears its own kit: helm, tabard, sword and shield
  for the Guardian, a fur hood and greataxe for the Berserker, hood, mask and twin daggers for the Shadowblade, a
  feathered hat, quiver and longbow for the Ranger, a witch hat and staff for the Elementalist, a circlet, scepter and
  orb for the Tideweaver, an antlered hood and tome for the Summoner, and glowing runes and a runesword for the
  Spellblade. Your appearance (and any costume) is shared with other players.
- **Four races, eight classes**: Human (+5% XP from quests), Sylvan (tall elves with glowing tattoos, +5% Survival
  mastery), Draken (horns and scales, +5% Max HP) and Beastkin (wolf, fox or cat ears and tail, +5% move speed). Any
  race can play any class: Guardian (tank), Berserker (melee), Shadowblade (assassin), Ranger (ranged), Elementalist
  (mage), Tideweaver (healer), Summoner (controller) and Spellblade (hybrid).
- **Character creation**: sliders for face shape and width, eyes, nose, build and height, voice, hair style and color,
  beards, makeup, scars and tattoos, with no gender or race lock. Save up to six presets and share them as codes. The
  Wardrobe re-customizes your hero: free once a month, then for gold.
- **Skills**: every class has 15 core skills (10 active, 5 passive) learned from Lv 1 to 90, and two awakening paths
  from Lv 100 with a new skill every 10 levels up to an ultimate at Lv 200. You get one skill point per level and three
  per cleared trial; each skill has 10 ranks, and ranks above 5 need weapon mastery of 10 x the rank. Passives are
  always on. Your loadout holds 6 actives and the ultimate (keys 1-7). Respec is free in town once a day; switching
  paths costs a Trial Sigil.
- **Action combat**: a low dodge roll (Shift) with invulnerable frames, where the first 0.2 s is a perfect dodge; Space
  jumps; Guardians block from the front (hold the right mouse button; a just-in-time block stops the hit); parries; aimed skills that land at the cursor
  (or straight ahead); a stamina bar for rolls. Auto-hit (T) fights the nearest enemy from where you stand but never
  moves, dodges or picks a path, and it is off inside dungeons and trials.
- **Earned levels**: the next level takes floor(500 x L^2.2) XP (about 57 million from 199 to 200). Killing the same
  monster type over and over pays 5% less each time (down to 10%, recovering while you hunt elsewhere); monsters 3-5
  levels below you give 60%, 6-9 levels 20% and 10+ nothing. First visits pay discovery XP: a new zone 2% of a level, a
  hidden ruin 8%, a lore book 3%, a rare or elite first kill 10%, a waystone 5%. Dying drops 5% of the level as a soul
  marker you can walk back to within 10 minutes (it never costs a level). Parties of 2-5 get +10% per extra member, and
  a lower-level member grouped with someone 10+ levels above keeps the full XP of their own kills. Time offline banks
  rested XP (1% of a level per hour, up to half a level).
- **Masteries**: Weapon (hits and skills with your weapon type), Defense (blocks, dodges and parries; a perfect dodge
  counts three times) and Survival (exploring, gathering, crafting, cooking) run from 1 to 200. They never hold back a
  level-up; they unlock skill ranks above 5, higher gear tiers and map copying. They only grow against enemies within 5
  levels, and auto-hit kills in the open world give half. The Hero window always shows XP left, your masteries and the
  next trial.
- **Breakthrough trials**: a wall stands at Lv 20, 40, 60 ... 180, with the Final Ascension at 200. At Thalia the Trial
  Warden (Sylvan Haven) you craft a Trial Sigil from your bracket's ore, wood, herbs and spirit dust. Each trial is a
  solo fight where every hero of your class has the same stats, so only skill counts: I The Gate Warden (a duel against
  telegraphed attacks), II Lost Road (reach a shrine across a valley in 15 minutes with no map, only spoken directions
  and landmarks), III Twin Blades (two foes who take turns; interrupt Rising Fury), IV Hunger (survive 20 minutes with
  no potions, cooking meat and foraged food at a campfire), V The Mirror (your own class and loadout), VI Ashen
  Labyrinth (a maze that shifts, fire vents, a hidden exit), VII Stormcaller (the pattern changes every third of its
  health), VIII Gauntlet (five bosses, no healing between), IX The Silent Keeper (no visual tells, only a rumble, a
  chime and a hiss; captions in Settings) and the Final Ascension (all of it at once). A failed attempt keeps your XP
  and mastery and uses the sigil. A clear grants a title, an aura other players see and 3 skill points, and the first
  clears on each server go on the Hall of Firsts.
- **Cooking**: campfires in town, at every outpost and in the Hunger trial cook Raw Meat (from beasts), crops and herbs
  into skewers, bread, stew, pie, a feast and starberry soup: food heals over time and some dishes add a 2-minute bonus.
- **Finding your way**: the map fills in only where you have walked; every zone has three or four tall landmarks
  (windmills, watchtowers, giant trees, statues, arches, crystal spires); quest givers also tell you the way in words
  ("Head east, a fair walk, into Breezy Meadow. Look for the Windmill Spire...") and the journal in the Quest Log keeps
  their exact wording; the compass points north. Clicking the ground walks you only to what you can see (60 m), but the
  quest tracker's path finder walks (and rides) you all the way to the quest giver, the monsters or the dungeon, and quest
  givers show their marker from afar. Waystones at every outpost wake when you reach them on foot and are the only fast travel. Hidden ruins, lore
  books and Survey Maps (copied by players with Survival mastery 20+, tradable, they reveal a zone) reward exploring.
  Repeated identical input over a long time flags the account for the Game Master to review.
- **Main story**: six chapters and 58 quests from Lv 1 to Lv 200. Chapter I (The Restless Spirits) ends with the
  Treant King Yggr; Chapter II (The Withering Bloom, Sunpetal Plains and Whispering Marsh), III (Embers of the Old War,
  Ember Canyon and Frostpeak), IV (The Crystal Choir), V (Shadows Beneath the Roots) and VI (Starfall, ending in the
  Throne of Yggdrasil) follow the zones. Objectives include kills, quest-item collection, field bosses, dungeon clears
  and level gates (a quest waits until you reach its level, shown in the tracker). Chapter finales award titles, pets,
  mounts and Unique or Legendary gear. Click the quest tracker (or Auto-path in the Quest Log) to auto-path to the next step.
- **Pets, sprites, mounts and wings**: 27 collectible pets that fight beside you (up to Lv 60), 4 elemental sprites,
  13 mounts and fairy wings. New pets and mounts drop from the new monsters and bosses or are sold by Mimi and Brom.
- **Pet abilities**: every pet lends you its own ability while summoned, and it grows each time you feed the pet.
  Healers (Scoopy heals you every 5s, Petalle heals on every skill cast, Flurry wraps you in a shield every 20s, Buzzy
  restores mana), defenders (Wobbles and Skye cut damage taken, Boo dodges attacks, Prism reflects damage, Blaze
  saves you from a killing blow once every 5 minutes), boosters (Hootie +Crit, Fluffkin +move speed, Cupcake Puff
  +Attack and Defense, Sparky +Attack and Crit Damage, Bao +Max HP, Pip shorter cooldowns, Nyx lifesteal), attackers
  (Mushy poisons, Pengu freezes, Cinder splashes fire, Ribbit attacks faster, Fluffle stomps, Twinkle calls falling
  stars, Kohaku throws fox fire, Frostbite breathes frost) and finders (Mochi more gear drops, Kitsu more EXP, Pumpkin
  Pip more Gold). The Pets panel shows each ability and what it becomes at Lv 60.
- **Costumes**: 23 cosmetic outfits, hats and wings in Coco the Costume Tailor's Wardrobe. They change only your look,
  never your stats. Buy them at Coco's Boutique, find them in Wardrobe Boxes, or sew them yourself.
- **Tailoring (costumes from ingredients)**: Coco's Wardrobe has a Tailoring tab where every costume has a pattern:
  Linen Bolts, Silk Thread, Fluffy Feathers (for wings), Starlit Velvet for the finest pieces, Star Essence, and dyes
  matching the costume's colors. Cloth and feathers drop from monsters (finer cloth at higher levels, velvet from Lv 80,
  elites, bosses and the Danger Zone) and Coco sells linen and silk. The five dyes (Rose, Sky, Gold, Leaf, Shadow) are
  mixed at Coco from herbs, crops, ore and logs.
- **Dungeons**: eleven instanced dungeons with their own entrances in the world, from Mossy Hollow (Lv 6) to the
  Throne of Yggdrasil, where Fenrir, the World Devourer waits as the Lv 200 boss. Clear each chamber to break the rune
  seal ahead, then fight a boss with telegraphed attacks (slams, novas, root bursts, dragon breath, summons). Dungeons
  are hard: monsters inside are tougher than in the field, a run fails after 15 minutes or a fourth death, and bosses go
  berserk after 4 minutes. Runs are rated S/A/B; the rating sets the size of the treasure chest.
- **Danger Zone (Bloodmoon Wastes)**: a blood-red wasteland south-west of town, marked on the minimap and World Map.
  Inside, players can attack each other (party members excepted; hits between players deal 40% of their monster
  damage). Whoever falls drops 10% of their gold and up to 3 unlocked bag items in a loot sack on the spot; the first
  player to reach it takes everything, and the owner can run back within 5 minutes to reclaim it. Monsters inside are
  highly lethal (always a few levels above you, twice the attack, more HP) and drop pieces of the four **Ancient sets**
  (their tier follows the monster's level; true Ancient-tier pieces drop from Lv 180, one per account per season): Bloodmoon (kills heal and boost Attack), Dreadforge (less damage taken,
  stuns attackers), Voidwalker (void rifts every 8s) and Kingslayer (+30% damage to players, elites and bosses). The
  Bloodmoon Tyrant guards the center. The sky turns red while you are inside and enemy players get red nameplates.
- **Dungeon sets**: each dungeon's chest can hold a piece of its own four-piece set (always on the first clear, then
  25/40/60% by rating, favouring pieces you lack). Two pieces add stats; all four unlock a set power found nowhere else:
  Moss Mend, Grave Pact, Entangle, Swarm, Riptide, Molten Core, Shatter, Refraction, Soul Harvest, Constellation and
  Spirit Covenant. Tooltips and the Dungeons window show which pieces you own; set pieces cannot be ascended.
- **Town services at their NPCs**: windows open only at the NPC who runs them. Gorm the Blacksmith (Forge: enhance,
  craft, upgrade, salvage, smithing, Crimson Forge), Opal the Gemcutter (Gem Workshop), Vera the Alchemist (alchemy),
  Mira the Market Merchant (Market and Auction House), Grimsby the Auctioneer, Aldric the Guild Master (guilds and guild
  wars) and Coco the Costume Tailor (Wardrobe). Their old hotkeys and mission buttons walk you to the NPC and open the
  window when you are close; from farther away they tell you where to find the keeper. The World Map lists them
  under Town services.
- **NPC role icons**: every NPC has an icon before their name (an anvil for Gorm, a gem for Opal, a potion stand for
  Vera, a paw for Mimi...). The same icons mark them on the minimap, and the World Map's **Sylvan Haven** tab shows the
  whole town with each keeper's icon and name.
- **Relic collections and Red gear**: every dungeon hides four collection relics (crown, seal, idol and tome) dropped by
  its monsters and chest. Completing a set gives a permanent Attack and HP bonus. Four relics of one dungeon, a Crimson
  Core, Star Essence and gold forge a **Red** item at the Crimson Forge: the new top rarity, with four affixes, a
  legendary power and three gem sockets.
- **Eight item tiers**: Common (white, x1.0), Uncommon (green, x1.2, a bonus stat), Rare (blue, x1.5, two, Lv 20+),
  Special (purple, x1.9, two plus a small passive, Lv 40+), Unique (orange, x2.4, a named power, Lv 60+), Legendary
  (gold, x3.0, Lv 100+), Red (crimson, x3.8, awakens one of your skills, Lv 140+) and Ancient (bronze glow, x5.0, your
  name engraved, one per account per season, Lv 180+). World drops follow 60 / 25 / 10 / 3.5 / 1.2 / 0.25%, and no tier
  drops below its level. Wearing an item needs weapon mastery equal to its tier's level. Legendary and up are
  account-bound and glow around you for every player to see. Gear loses durability each time you fall (Gorm repairs
  it; Red and Ancient need rare materials). Items can climb one tier at the Forge (Red never becomes Ancient).
- **Six-piece sets** (helmet, armor, gloves, boots, necklace, ring; bonuses at 2, 4 and 6 pieces): Wayfarer's Garb,
  Ironbound Guard, Shadowstep, Emberheart, Tidewarden, Crown of the Fallen King, Bloodsworn Pact and Relics of the First
  Dawn, plus the beast sets Minotaur, Griffin, Basilisk, Hydra, Kraken, Cerberus, Phoenix, Fenrir and Jörmungandr. They
  drop from field elites, world bosses, dungeon chests, hidden ruins and trials. Battle Rating is level x 100 + gear x
  tier multiplier + average mastery x 50, and it is only a guide: content gates use level, mastery and trials.
- **Loot**: gear drops on the ground with a light beam in its rarity color. Unique and Legendary items are named and
  carry a special power, such as chain lightning, meteor strikes every 6th hit, phoenix rebirth or a healing nova. Loot
  auto-collects (toggle in Settings).
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
- **Game Master Console**: the server list on the title screen has a Game Master Console link for the artifact's owner
  and editors (and in any local copy). In the published version the game reports each signed-in player's status to the
  artifact's shared database, and the console shows players online, levels, classes, zones, gear, play time, an
  activity feed (level ups, dungeon clears, deaths, rare loot), client errors and the server clock. From it the owner can
  post an announcement, start an EXP/Gold event, show a maintenance notice and send gifts to everyone or to one player.
  Players with view-only access cannot report, so share the game as Contributor to see them.
- **Title screen**: the world turns behind a winged Aetherheim Tales Online crest. The server list (Elysium, Valhalla,
  Zephyr, Solaria, Nordheim, Yggdrasil) shows each server's status and how many heroes are on it right now (Low, Medium,
  High), read live from the multiplayer service without joining it. **Enter Game** continues your hero; a new hero is
  one click below.
- **Play together (real time)**: on the website, everyone who picks the same server on the title screen shares one
  world. You see each other walk, ride and wear costumes, your chat reaches everyone on the server, and the **Online**
  panel lists who is on and tells you where they are. Monsters, loot and progress stay
  separate for each player, and a player inside a dungeon or guild war is hidden until they come back. It runs on a free
  Supabase Realtime channel (broadcast and presence, no database tables): put the project URL and its **publishable**
  key in `js/mp-config.js`. With no key, or inside the claude.ai page, the game plays solo as before.
- **Parties**: click another player and press **Invite** (or use the Online panel) to team up, up to 5 players.
  Party members within 60 m of a kill share its EXP: the kill's EXP is split between everyone nearby, plus 10% per extra
  member, and each member's own level gap and EXP boosts apply to their share. The party frame under your wallet
  shows members' levels and HP (dimmed when too far to share), `/p message` or the Party chat tab talks to the party,
  the earliest member leads and can remove players, and reloading the page keeps you in your party.
- **Seasons, festivals and leaderboards**: each month is a season with a 30-tier Season Pass (free and premium tracks)
  and a Season leaderboard that pays out when the month ends. Leaderboards also rank Battle Rating, Level, World Boss
  damage, dungeon speed, guild war wins and guilds. Festivals follow the calendar: the Harvest Moon (October to early
  November) brings Jackpuffs, the Pumpkin King, Moon Candy, pumpkin decorations in town and a festival shop with the
  Pumpkin Pip pet, orange fairy wings and a title. Winter Starlight (December) and Sakura Bloom (spring) work the same way.
- **Professions**: Mining, Herbalism and Logging at ore veins, herbs and trees in every zone (five tiers, each
  needing a higher skill level and the right tool); Farming on eight plots at the homestead west of town, where seven crops grow in real
  time (water and fertilize to speed them up); Alchemy turns herbs and produce into stronger potions and timed elixirs
  (Might, Iron Skin, Swiftness, Wisdom, Fortune, Phoenix Draught); Smithing turns ore and logs into gear and Crimson
  Cores. Each profession levels to 100.
- **Gathering tools and animations**: chopping a tree needs an **Axe**, mining ore a **Pickaxe** and cutting herbs a
  **Sickle**. Tools come in five metals (Copper, Iron, Silver, Mithril, Starmetal); each one works on nodes up to its own
  tier and gathers faster and finds more on lower tiers. Every new hero starts with Copper tools, Hilda and the outposts
  sell them, and Gorm forges each tier from the one before (Forge > Smithing > Gathering Tools). Tools ride on a tool
  belt above the skill bar (Axe, Pickaxe, Sickle; keys 8, 9, 0) instead of the bag: a better tool goes straight onto the
  belt and the old one into the bag, and using a spare from the bag swaps it in. Clicking a belt slot walks you to the
  nearest node that tool can work and starts gathering: your hero steps up, holds it and swings, the tree shakes and drops chips and leaves, the
  rock throws sparks and stone chips, and the herbs rustle, with matching sounds.
- **Shops, auction and trading**: new NPCs in town run shops: Hilda (supplies, bag scrolls), Tilly (seeds), Vera
  (alchemy), Opal (gems), Coco (costumes), Elias (relics and Crimson Cores), plus pet and stable shops and a trader at
  every outpost. Grimsby runs the **Auction House**: real-time lots with bidding, buyouts and rival bids, and your
  own auctions.
- **Bag**: 48 slots, expandable to 160 with Bag Expansion Scrolls, gold or diamonds. Your equipped gear is shown inside
  the Bag window, next to the slots (tap a piece to see it or take it off), with the selected item's details below it.
  **Sell All** sells everything up to a chosen rarity in one go; locked gear is always kept.
- **MMO systems**: Battle Rating, bag, auto-hit, auto potions, titles, daily sign-in, online gifts, a gold/diamond mall
  (no XP or progress for sale), world and guild chat, minimap and world map.
- **Quick access menus**: activities sit in a slim panel at the top right (Online, Missions, Dungeon, the World Boss
  timer) and the character menu in a compact panel at the bottom right (Hero, Bag, Skills, Pets, Gathering, Quests,
  Map). **More** expands each panel to the rest and collapses again when you pick something or click away; a red dot
  on More means something inside is waiting.
- **Phones and tablets**: on small screens the HUD docks to a bar along the bottom (Events, Hero, Bag, Skills, Quests,
  Chat, More). Events and More open as sheets above the dock that close when you pick something or tap the game; a red
  dot marks a sheet with something waiting. The skill bar sits above the dock with Mount, Auto, Roll and Block above it, a joystick
  in the bottom-left corner (with the tool belt above it) walks your hero (one thumb walks while the other turns the camera; tapping the ground still
  works), and the layout also works in landscape.
- **Icons**: every icon is a hand-made SVG in `js/icons/`, so nothing depends on the device's emoji font.

## Controls

| Action | Input |
| --- | --- |
| Move / attack / talk | Click (or tap) the ground you can see, a monster or an NPC; WASD also moves |
| Camera | Drag to rotate, scroll or pinch to zoom |
| Skills | 1–6, ultimate 7 |
| Tool belt | 8 Axe, 9 Pickaxe, 0 Sickle (gather the nearest node) |
| Dodge roll / jump / block | Shift / Space / hold the right mouse button (Guardians) |
| Potions | Q (HP), E (MP) |
| Mount / Auto-hit | R / T |
| Panels | C character, B bag, K skills, P pets, U mounts, Z professions, L quests, M map, O settings |
| Live systems | H missions, X codex, J season pass; Y forge, N market, G guild and V wardrobe walk you to their NPC |
| Other | Tab next target, F talk, Enter chat, Esc close |

Progress saves to the browser's local storage. Daily and weekly resets, world boss times and seasons follow the real clock (UTC).
The only other players in the world are real ones on your server (see Play together). Guildmates, guild war rivals,
market buyers and auction bids are simulated, so those systems also work solo.

## Code layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Monsters, pets, mounts, quests and other tables |
| `js/data-classes.js`, `js/combat.js`, `js/combat-world.js` | Races, the eight classes and their skills; the skill book, loadout, rolls, blocks, parries and every skill's effect |
| `js/models-hero.js`, `js/customizer.js` | Toy-style heroes and the character customizer (sliders, presets, share codes) |
| `js/progress.js` | XP curve, masteries, trial walls, diminishing returns, discovery XP, soul markers, rested XP, explored-map grid, Battle Rating |
| `js/data-trials.js`, `js/trials.js`, `js/ui-trials.js` | Breakthrough trials, sigils, cooking, auras and the Hall of Firsts |
| `js/data-nav.js`, `js/nav-world.js` | Landmarks, waystones, spoken directions and journal, hidden ruins, lore books, survey maps, fair-play check |
| `js/gear.js` | Mastery lock, durability and repairs, binding, gear glow, Ancient items, six-piece set powers and drops |
| `js/data-world.js` | Expanded world content: outer zones, Lv 16-200 monsters, dungeons 4-11, relics, professions, crops, recipes, costumes, shops |
| `js/life.js` | Gathering nodes, farming, alchemy, smithing, elixirs, costumes, relic collection and Red gear |
| `js/economy.js` | Bag expansion, Sell All, NPC shops and the Auction House |
| `js/upgrade.js` | Enhancement +1 to +15, arcane gems, Soulstones, Socket Drill and Soul Forge |
| `js/live.js` | Live link to the artifact's shared database: player status, announcements, events, gifts |
| `js/admin.js` | Game Master Console |
| `js/mp.js`, `js/mp-config.js` | Real-time multiplayer over Supabase Realtime: other players, chat, Online panel |
| `js/party.js` | Parties: invitations, party frame and chat, shared EXP |
| `js/data-story.js` | Main story chapters II-VI, quest items and chapter titles |
| `js/data-sets.js` | Dungeon sets, Ancient sets and the 17 six-piece sets with their powers |
| `js/data-pets.js` | Pet abilities and how they grow with pet level |
| `js/data-crafting.js`, `js/gather.js` | Gathering tools (items, forging recipes, the tool belt, the tool in hand and the swing animations) |
| `js/tailor.js` | Tailoring: costume patterns, dyes and cloth drops |
| `js/data-dz.js`, `js/dz.js` | Danger Zone: monsters, PvP between players, loot sacks and Ancient set powers |
| `js/models-monsters.js`, `js/models-extra.js` | New monsters and bosses; new pets, mounts, gathering nodes and crops |
| `js/toon.js` | Cel-shaded materials, ink outlines and canvas textures |
| `js/models.js` | Procedural chibi characters, monsters, pets, mounts and sprites |
| `js/world.js` | Terrain, town, scenery batching, collision grid and A* pathfinding |
| `js/fx.js` | Particles, skill effects, projectiles, telegraphs and combat text |
| `js/game.js` | Game state, combat, AI, quests, inventory, loot drops, dungeon runs and saving |
| `js/systems.js` | Missions, guilds, guild wars, world bosses, materials, crafting, market, gear upgrades, codex, festivals, season pass and leaderboards |
| `js/systems-data.js` | Tables for the systems above (missions, recipes, guilds, market goods, festivals, season rewards) |
| `js/models-event.js` | World bosses, festival monsters and pets, guild war crystals |
| `js/loot.js` | The eight rarity tiers, affixes, named Unique/Legendary items, set pieces and loot rolls |
| `js/dungeon.js` | Dungeon and guild-war arena environments, rune seals, chests, exit portals and overworld entrances |
| `js/models-dungeon.js` | Dungeon monsters and bosses |
| `js/nav.js` | Walkability grid and A* pathfinding shared by the world and dungeons |
| `js/icons.js`, `js/icons/*.js` | SVG icon set (skills, UI, items) |
| `js/ui.js` | HUD, panels, dialogs, chat, minimap and world map |
| `js/ui-systems.js` | Panels and HUD widgets for the live systems |
| `js/ui-life.js` | Professions, farm, Crimson Forge, collection, wardrobe, shop, auction and Online panels |
| `js/main.js` | Boot, title screen, character creation and main loop |
