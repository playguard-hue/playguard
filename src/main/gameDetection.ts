import { promises as fs } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as vdf from 'vdf-parser'

const execAsync = promisify(exec)

export interface DetectedGame {
  appId: string
  name: string
  source: 'steam'
}

/**
 * Read the actual Steam install path from the Windows registry.
 * Steam writes this to HKCU\Software\Valve\Steam\SteamPath.
 */
async function getSteamPath(): Promise<string | null> {
  if (process.platform !== 'win32') return null

  try {
    const { stdout } = await execAsync(
      'reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v SteamPath'
    )
    // Output looks like:
    //     SteamPath    REG_SZ    d:/steam
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+?)[\r\n]/)
    if (!match) return null
    // Normalize forward slashes to backslashes for Windows
    return match[1].trim().replace(/\//g, '\\')
  } catch {
    return null
  }
}

/**
 * Steam can store games in multiple "library folders" across drives.
 * Reads steamapps/libraryfolders.vdf to find them all.
 */
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
          if (!folders.includes(steamappsPath)) {
            folders.push(steamappsPath)
          }
        }
      }
    }
  } catch {
    // libraryfolders.vdf missing or malformed — just use the default
  }

  return folders
}

/**
 * Scans all Steam library folders and builds a map of appId → game name.
 */
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

          // ACF files have a simple key-value format. We extract appid and name
          // with regex — much more reliable than vdf-parser for our needs.
          const appIdMatch = content.match(/"appid"\s+"(\d+)"/i)
          const nameMatch = content.match(/"name"\s+"([^"]+)"/i)

          if (appIdMatch && nameMatch) {
            library.set(appIdMatch[1], nameMatch[1])
          }
        } catch {
          // Skip malformed manifests
        }
      }
    } catch {
      // Folder doesn't exist or no permission
    }
  }

  return library
}

/**
 * Reads HKCU\Software\Valve\Steam\RunningAppID.
 * 0 means no game running, otherwise it's the active game's appId.
 */
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

/**
 * Main detection function — returns the currently active game, or null.
 */
export async function detectActiveGame(): Promise<DetectedGame | null> {
  const runningAppId = await getSteamRunningAppId()
  if (!runningAppId) return null

  const library = await getSteamGameLibrary()
  const name = library.get(runningAppId) ?? `Unknown game (${runningAppId})`

  return {
    appId: runningAppId,
    name,
    source: 'steam'
  }
}