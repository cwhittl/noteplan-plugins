// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import pluginJson from '../plugin.json'

import { semverVersionToNumber } from '@helpers/general'
import { clo, log, logError } from '@helpers/dev'

type GlobalsConfig = $ReadOnly<{
  locale?: string,
  userFirstName?: string,
  userLastName?: string,
  userEmail?: string,
  userPhone?: string,
  dateFormat?: string,
  timeFormat?: string,
  nowFormat?: string,
}>

// NOTE: When adding new properties, make sure the `plugin.json/plugin.settings` are updated
export const DEFAULT_GLOBALS_CONFIG = {
  locale: 'en-US',
  userFirstName: 'John',
  userLastName: 'Doe',
  userEmail: 'john.doe@gmail.com',
  userPhone: '(714) 555-1212',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  nowFormat: 'YYYY-MM-DD h:mm:ss A',
}

export default class NPGlobals {
  globalConfig: any
  constructor() {
    // DON'T DELETE
    // constructor method required to access instance config (see setup method)
    /**
     * Initializes the instance with `templateConfig` from settings, and list of global methods (as defined in `globals.js`)
     */
  }

  static async setup() {
    try {
      const data = await this.getSettings()
      this.constructor.globalConfig = { ...data }
    } catch (error) {
      await CommandBar.prompt('Global Plugin Error', error)
    }
  }

  static async getSettings(): any {
    let data = DataStore.loadJSON('../np.Globals/settings.json')
    if (!data) {
      const result = DataStore.saveJSON(DEFAULT_GLOBALS_CONFIG, `../${pluginJson['plugin.id']}/settings.json`)
      data = DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    }

    return data
  }

  static async updateOrInstall(currentSettings: any, currentVersion: string): Promise<GlobalsConfig> {
    const settingsData = { ...currentSettings }

    // current settings version as number
    const settingsVersion: number = semverVersionToNumber(settingsData?.version || '')

    // update settings version to latest version from plugin.json
    settingsData.version = pluginJson['plugin.version']
    log(pluginJson, `==> ${pluginJson['plugin.id']} Settings Version ${currentVersion}`)

    // return new settings
    return settingsData
  }
}
