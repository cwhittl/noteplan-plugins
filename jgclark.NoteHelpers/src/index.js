// @flow

// -----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// last updated 22.3.2023 for v0.16.0, @jgclark
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

import { JSP, logDebug, logError } from '@helpers/dev'
import { updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { countAndAddDays } from './countDays'
export { indexFolders } from './indexFolders'
export {
  jumpToDone,
  jumpToHeading,
  jumpToNoteHeading,
  openCurrentNoteNewSplit,
  openNoteNewWindow,
  openNoteNewSplit
} from './noteNavigation'
export {
  addTriggerToNote,
  convertLocalLinksToPluginLinks,
  addFrontmatterToNote,
  moveNote,
  renameNoteFile,
} from './noteHelpers'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const configKey = 'noteHelpers'

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${configKey}: onUpdateOrInstall running`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
