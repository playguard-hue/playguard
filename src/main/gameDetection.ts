import { promises as fs } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as vdf from 'vdf-parser'

const execAsync = promisify(exec)

export type GameSource =
  | 'steam'
  | 'epic'
  | 'battlenet'
  | 'riot'
  | 'gog'
  | 'ea'
  | 'ubisoft'
  | 'xbox'
  | 'standalone'

export interface DetectedGame {
  appId: string
  name: string
  source: GameSource
}

// ═══════════════════════════════════════════════════════════════
// Process scanning utility (used by most detectors)
// ═══════════════════════════════════════════════════════════════

async function getRunningProcesses(): Promise<Set<string>> {
  if (process.platform !== 'win32') return new Set()
  try {
    const { stdout } = await execAsync('tasklist /fo csv /nh')
    const procs = new Set<string>()
    for (const line of stdout.split('\n')) {
      const match = line.match(/^"([^"]+)"/)
      if (match) procs.add(match[1].toLowerCase())
    }
    return procs
  } catch {
    return new Set()
  }
}

// Background processes we never want to count as "active game"
const PROCESS_BLACKLIST = new Set([
  'steam.exe',
  'steamwebhelper.exe',
  'steamservice.exe',
  'epicgameslauncher.exe',
  'epicwebhelper.exe',
  'battle.net.exe',
  'battle.net helper.exe',
  'agent.exe',
  'blizzardbrowser.exe',
  'riotclientservices.exe',
  'riotclientux.exe',
  'riotclientuxrender.exe',
  'galaxy.exe',
  'galaxyclient.exe',
  'galaxycommunication.exe',
  'eadesktop.exe',
  'eabackgroundservice.exe',
  'origin.exe',
  'originwebhelperservice.exe',
  'upc.exe',
  'ubisoftconnect.exe',
  'ubisoftgamelauncher.exe',
  'ubisoftgamelauncher64.exe',
  'gameoverlayui.exe',
  'vanguard.exe',
  'vgc.exe',
  'vgtray.exe'
])

// ═══════════════════════════════════════════════════════════════
// 1. STEAM
// ═══════════════════════════════════════════════════════════════

async function getSteamPath(): Promise<string | null> {
  if (process.platform !== 'win32') return null
  try {
    const { stdout } = await execAsync(
      'reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v SteamPath'
    )
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+?)[\r\n]/)
    if (!match) return null
    return match[1].trim().replace(/\//g, '\\')
  } catch {
    return null
  }
}

async function getSteamLibraryFolders(steamPath: string): Promise<string[]> {
  const folders = [join(steamPath, 'steamapps')]
  try {
    const libVdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
    const content = await fs.readFile(libVdfPath, 'utf-8')
    const parsed = vdf.parse(content) as {
      libraryfolders?: Record<string, { path?: string }>
    }
    if (parsed.libraryfolders) {
      for (const key of Object.keys(parsed.libraryfolders)) {
        const folderPath = parsed.libraryfolders[key]?.path
        if (folderPath) {
          const normalized = folderPath.replace(/\\\\/g, '\\')
          const steamappsPath = join(normalized, 'steamapps')
          if (!folders.includes(steamappsPath)) folders.push(steamappsPath)
        }
      }
    }
  } catch {
    /* ignore */
  }
  return folders
}

async function getSteamGameLibrary(): Promise<Map<string, string>> {
  const library = new Map<string, string>()
  const steamPath = await getSteamPath()
  if (!steamPath) return library
  const folders = await getSteamLibraryFolders(steamPath)
  for (const folder of folders) {
    try {
      const files = await fs.readdir(folder)
      const manifests = files.filter(
        (f) => f.startsWith('appmanifest_') && f.endsWith('.acf')
      )
      for (const manifest of manifests) {
        try {
          const content = await fs.readFile(join(folder, manifest), 'utf-8')
          const appIdMatch = content.match(/"appid"\s+"(\d+)"/i)
          const nameMatch = content.match(/"name"\s+"([^"]+)"/i)
          if (appIdMatch && nameMatch) {
            library.set(appIdMatch[1], nameMatch[1])
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
  }
  return library
}

async function getSteamRunningAppId(): Promise<string | null> {
  if (process.platform !== 'win32') return null
  try {
    const { stdout } = await execAsync(
      'reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v RunningAppID'
    )
    const match = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/)
    if (!match) return null
    const appId = parseInt(match[1], 16)
    if (appId === 0) return null
    return appId.toString()
  } catch {
    return null
  }
}

async function detectSteam(): Promise<DetectedGame | null> {
  const runningAppId = await getSteamRunningAppId()
  if (!runningAppId) return null
  const library = await getSteamGameLibrary()
  const name = library.get(runningAppId) ?? `Unknown game (${runningAppId})`
  return { appId: runningAppId, name, source: 'steam' }
}

// ═══════════════════════════════════════════════════════════════
// 2. EPIC GAMES
// ═══════════════════════════════════════════════════════════════

interface EpicManifest {
  AppName?: string
  DisplayName?: string
  InstallLocation?: string
  LaunchExecutable?: string
}

async function getEpicManifests(): Promise<EpicManifest[]> {
  if (process.platform !== 'win32') return []
  const manifestDir =
    'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests'
  try {
    const files = await fs.readdir(manifestDir)
    const items = files.filter((f) => f.endsWith('.item'))
    const manifests: EpicManifest[] = []
    for (const file of items) {
      try {
        const content = await fs.readFile(join(manifestDir, file), 'utf-8')
        manifests.push(JSON.parse(content))
      } catch {
        /* skip */
      }
    }
    return manifests
  } catch {
    return []
  }
}

async function detectEpic(
  runningProcesses: Set<string>
): Promise<DetectedGame | null> {
  const manifests = await getEpicManifests()
  for (const m of manifests) {
    if (!m.LaunchExecutable || !m.DisplayName) continue
    const execName = m.LaunchExecutable.split(/[\\/]/).pop()?.toLowerCase()
    if (!execName) continue
    if (runningProcesses.has(execName)) {
      return {
        appId: m.AppName ?? execName,
        name: m.DisplayName,
        source: 'epic'
      }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 3. BATTLE.NET
// ═══════════════════════════════════════════════════════════════

const BATTLENET_GAMES: Record<string, string> = {
  'wow.exe': 'World of Warcraft',
  'wowclassic.exe': 'World of Warcraft Classic',
  'overwatch.exe': 'Overwatch 2',
  'diablo iv.exe': 'Diablo IV',
  'diablo iv launcher.exe': 'Diablo IV',
  'diablo3.exe': 'Diablo III',
  'diablo ii resurrected.exe': 'Diablo II: Resurrected',
  'hearthstone.exe': 'Hearthstone',
  'heroes of the storm.exe': 'Heroes of the Storm',
  'heroesofthestorm_x64.exe': 'Heroes of the Storm',
  'starcraft.exe': 'StarCraft: Remastered',
  'starcraft ii.exe': 'StarCraft II',
  'sc2.exe': 'StarCraft II',
  'warcraftiii.exe': 'Warcraft III: Reforged',
  'modernwarfare.exe': 'Call of Duty: Modern Warfare',
  'cod.exe': 'Call of Duty',
  'codm.exe': 'Call of Duty',
  'blackopscoldwar.exe': 'Call of Duty: Black Ops Cold War'
}

function detectBattlenet(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(BATTLENET_GAMES)) {
    if (runningProcesses.has(exe)) {
      return { appId: exe, name, source: 'battlenet' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 4. RIOT GAMES
// ═══════════════════════════════════════════════════════════════

const RIOT_GAMES: Record<string, string> = {
  'valorant.exe': 'VALORANT',
  'valorant-win64-shipping.exe': 'VALORANT',
  'leagueclient.exe': 'League of Legends',
  'league of legends.exe': 'League of Legends',
  'leagueoflegends.exe': 'League of Legends',
  'wildrift.exe': 'Wild Rift',
  'legendsofruneterra.exe': 'Legends of Runeterra'
}

function detectRiot(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(RIOT_GAMES)) {
    if (runningProcesses.has(exe)) {
      return { appId: exe, name, source: 'riot' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 5. GOG GALAXY
// ═══════════════════════════════════════════════════════════════

interface GogGameInfo {
  exeName: string
  displayName: string
}

/**
 * GOG stores installed games in registry under HKLM\Software\WOW6432Node\GOG.com\Games\<id>
 * Each has values like: gameID, gameName, exe, path
 */
async function getGogGames(): Promise<GogGameInfo[]> {
  if (process.platform !== 'win32') return []
  const games: GogGameInfo[] = []
  try {
    const { stdout } = await execAsync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games" /s'
    )
    // Parse output — each game has its own subkey
    const blocks = stdout.split(/\r?\n\r?\n/)
    for (const block of blocks) {
      const exeMatch = block.match(/\bexe\s+REG_SZ\s+(.+?)[\r\n]/i)
      const nameMatch = block.match(/gameName\s+REG_SZ\s+(.+?)[\r\n]/i)
      if (exeMatch && nameMatch) {
        const exePath = exeMatch[1].trim()
        const exeName = exePath.split(/[\\/]/).pop()?.toLowerCase()
        if (exeName) {
          games.push({ exeName, displayName: nameMatch[1].trim() })
        }
      }
    }
  } catch {
    /* GOG not installed */
  }
  return games
}

async function detectGog(
  runningProcesses: Set<string>
): Promise<DetectedGame | null> {
  const games = await getGogGames()
  for (const g of games) {
    if (runningProcesses.has(g.exeName)) {
      return { appId: g.exeName, name: g.displayName, source: 'gog' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 6. EA APP / ORIGIN
// ═══════════════════════════════════════════════════════════════

const EA_GAMES: Record<string, string> = {
  'fifa23.exe': 'FIFA 23',
  'fifa24.exe': 'EA Sports FC 24',
  'fc24.exe': 'EA Sports FC 24',
  'fc25.exe': 'EA Sports FC 25',
  'apex_legends.exe': 'Apex Legends',
  'r5apex.exe': 'Apex Legends',
  'battlefield 2042.exe': 'Battlefield 2042',
  'bf2042.exe': 'Battlefield 2042',
  'bf1.exe': 'Battlefield 1',
  'bfv.exe': 'Battlefield V',
  'starwarsbattlefrontii.exe': 'Star Wars Battlefront II',
  'thesims4.exe': 'The Sims 4',
  'ts4_x64.exe': 'The Sims 4',
  'masseffectlauncher.exe': 'Mass Effect Legendary Edition',
  'masseffect1.exe': 'Mass Effect: Legendary Edition',
  'dragonage.exe': 'Dragon Age',
  'dragonageinquisition.exe': 'Dragon Age: Inquisition',
  'nfs.exe': 'Need for Speed',
  'jediFallenOrder.exe': 'Star Wars Jedi: Fallen Order'.toLowerCase()
}

function detectEa(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(EA_GAMES)) {
    if (runningProcesses.has(exe.toLowerCase())) {
      return { appId: exe, name, source: 'ea' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 7. UBISOFT CONNECT
// ═══════════════════════════════════════════════════════════════

const UBISOFT_GAMES: Record<string, string> = {
  'ac4bfsp.exe': "Assassin's Creed IV: Black Flag",
  'aco.exe': "Assassin's Creed Origins",
  'acodyssey.exe': "Assassin's Creed Odyssey",
  'acvalhalla.exe': "Assassin's Creed Valhalla",
  'acmirage.exe': "Assassin's Creed Mirage",
  'farcry5.exe': 'Far Cry 5',
  'farcry6.exe': 'Far Cry 6',
  'farcrynewdawn.exe': 'Far Cry New Dawn',
  'thedivision.exe': 'Tom Clancy\'s The Division',
  'thedivision2.exe': 'Tom Clancy\'s The Division 2',
  'rainbowsix.exe': 'Tom Clancy\'s Rainbow Six Siege',
  'rainbowsix_vulkan.exe': 'Tom Clancy\'s Rainbow Six Siege',
  'r6siege.exe': 'Tom Clancy\'s Rainbow Six Siege',
  'forhonor.exe': 'For Honor',
  'wd2.exe': 'Watch Dogs 2',
  'wdlegion.exe': 'Watch Dogs: Legion',
  'anno1800.exe': 'Anno 1800',
  'thecrew2.exe': 'The Crew 2',
  'thecrewmotorfest.exe': 'The Crew Motorfest'
}

function detectUbisoft(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(UBISOFT_GAMES)) {
    if (runningProcesses.has(exe)) {
      return { appId: exe, name, source: 'ubisoft' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 8. MICROSOFT STORE / XBOX
// ═══════════════════════════════════════════════════════════════

const XBOX_GAMES: Record<string, string> = {
  'minecraftlauncher.exe': 'Minecraft',
  'minecraft.windows.exe': 'Minecraft for Windows',
  'forzahorizon5.exe': 'Forza Horizon 5',
  'forzahorizon4.exe': 'Forza Horizon 4',
  'haloinfinite.exe': 'Halo Infinite',
  'mcc-win64-shipping.exe': 'Halo: The Master Chief Collection',
  'sea of thieves.exe': 'Sea of Thieves',
  'seaofthieves.exe': 'Sea of Thieves',
  'flightsimulator.exe': 'Microsoft Flight Simulator',
  'starfield.exe': 'Starfield',
  'agesofempires4.exe': 'Age of Empires IV',
  'relicCardinal.exe': 'Age of Empires IV'.toLowerCase()
}

function detectXbox(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(XBOX_GAMES)) {
    if (runningProcesses.has(exe.toLowerCase())) {
      return { appId: exe, name, source: 'xbox' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 9. STANDALONE GAMES (whitelist of known popular indies / launchers)
// ═══════════════════════════════════════════════════════════════

const STANDALONE_GAMES: Record<string, string> = {
  'minecraft.exe': 'Minecraft (Java)',
  'javaw.exe': 'Minecraft (Java)', // tricky — many things use javaw
  'fortnite.exe': 'Fortnite',
  'fortniteclient-win64-shipping.exe': 'Fortnite',
  'roblox.exe': 'Roblox',
  'robloxplayerbeta.exe': 'Roblox',
  'amongus.exe': 'Among Us',
  'gta5.exe': 'Grand Theft Auto V',
  'gtav.exe': 'Grand Theft Auto V',
  'rdr2.exe': 'Red Dead Redemption 2',
  'cyberpunk2077.exe': 'Cyberpunk 2077',
  'witcher3.exe': 'The Witcher 3',
  'eldenring.exe': 'Elden Ring',
  'darksoulsiii.exe': 'Dark Souls III',
  'sekiro.exe': 'Sekiro: Shadows Die Twice',
  'palworld-win64-shipping.exe': 'Palworld',
  'palworld.exe': 'Palworld',
  'lethal company.exe': 'Lethal Company',
  'rust.exe': 'Rust',
  'rustclient.exe': 'Rust',
  'terraria.exe': 'Terraria',
  'stardew valley.exe': 'Stardew Valley',
  'stardewvalley.exe': 'Stardew Valley',
  'hollow_knight.exe': 'Hollow Knight',
  'celeste.exe': 'Celeste',
  'helldivers2.exe': 'Helldivers 2',
  'pubg.exe': 'PUBG: Battlegrounds',
  'tslgame.exe': 'PUBG: Battlegrounds',
  'csgo.exe': 'Counter-Strike: Global Offensive',
  'cs2.exe': 'Counter-Strike 2',
  'dota2.exe': 'Dota 2',
  'tf2.exe': 'Team Fortress 2'
}

function detectStandalone(runningProcesses: Set<string>): DetectedGame | null {
  for (const [exe, name] of Object.entries(STANDALONE_GAMES)) {
    if (runningProcesses.has(exe) && !PROCESS_BLACKLIST.has(exe)) {
      return { appId: exe, name, source: 'standalone' }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

export async function detectActiveGame(): Promise<DetectedGame | null> {
  // 1. Steam first — cheapest (single registry read)
  const steam = await detectSteam()
  if (steam) return steam

  // 2. Get running processes once for all process-based detectors
  const procs = await getRunningProcesses()

  // 3. Try each launcher in order of specificity
  // (Battle.net, Riot, EA, Ubisoft, GOG have known game lists — high confidence)
  const battlenet = detectBattlenet(procs)
  if (battlenet) return battlenet

  const riot = detectRiot(procs)
  if (riot) return riot

  const ea = detectEa(procs)
  if (ea) return ea

  const ubisoft = detectUbisoft(procs)
  if (ubisoft) return ubisoft

  const xbox = detectXbox(procs)
  if (xbox) return xbox

  // 4. Manifest-based detection (Epic, GOG)
  const epic = await detectEpic(procs)
  if (epic) return epic

  const gog = await detectGog(procs)
  if (gog) return gog

  // 5. Last resort — known standalone games
  const standalone = detectStandalone(procs)
  if (standalone) return standalone

  return null
}