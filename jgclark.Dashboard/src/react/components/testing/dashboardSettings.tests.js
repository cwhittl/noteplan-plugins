// @flow

import { expect } from '@helpers/testing/expect'
import { type TestResult, waitFor } from '@helpers/testing/testingUtils'
import { clo, logDebug } from '@helpers/react/reactDev'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import type { AppContextType } from '../AppContext'

type Test = {
  name: string,
  test: (getContext: () => AppContextType) => Promise<void>,
}

type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

// helper functions for repeated use in tests

const getDashboardSettingsWithShowVarsSetTo = (context: AppContextType, showValue: boolean): Object => {
  return Object.keys(context.dashboardSettings).reduce(
    (acc, key) => {
      if (key.startsWith('show')) {
        acc[key] = showValue
      }
      if (key === 'showPrioritySection') {
        acc[key] = false // this one is too slow to ever turn on
      }
      return acc
    },
    { ...context.dashboardSettings },
  )
}

const sendDashboardSettingsToPlugin = (sendActionToPlugin, newDashboardSettings, message) => {
  const mbo = {
    actionType: `dashboardSettingsChanged`,
    settings: newDashboardSettings,
  }
  console.log(`sending this mbo to the plugin`, mbo)
  sendActionToPlugin('dashboardSettingsChanged', mbo, message)
}

// tests start here

export default {
  groupName: 'Dashboard Settings Tests',
  tests: [
    {
      name: `Set Dashboard Settings in plugin (turn all sections off)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, false)
        newDashboardSettings.lastChange = `Turning all sections off`
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections off`)

        await waitFor(2000) // Add a timeout to prevent indefinite waiting
        context = getContext() // so get the latest context after the waitFor
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in plugin (turn all sections on)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        const context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, true)
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // this one is too slow to turn on
        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Turning all sections on`)

        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        expect(context.dashboardSettings.showProjectSection).toBe(false, 'dashboardSettings.showProjectSection')
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections off -- false)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, false)
        newDashboardSettings.lastChange = `Turning all sections off (false)`
        context.dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newDashboardSettings })

        await waitFor(2000) // Add a timeout to prevent indefinite waiting

        context = getContext()
        console.log(`waitied for 2s and here is dashboardSettings`, context.dashboardSettings)
        // check that all show* settings are false
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show')) {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(false, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Set Dashboard Settings in react (turn all sections on -- true)`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const newDashboardSettings = getDashboardSettingsWithShowVarsSetTo(context, true)
        newDashboardSettings.lastChange = `Turning all sections on`
        newDashboardSettings.showPrioritySection = false // This one is too slow to turn on

        console.log('Sending this to DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS:')
        console.log(newDashboardSettings)
        context.dispatchDashboardSettings({
          type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
          payload: newDashboardSettings,
        })
        // Yield control to allow React to process the update
        await new Promise((resolve) => setTimeout(resolve, 0))
        await waitFor(1000)
        console.log('after 1s, here is dashboardSettings', context.dashboardSettings)
        // Wait for the dashboardSettings to update
        context = getContext()
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })

        console.log(`After waiting, here is dashboardSettings:`)
        console.log(context.dashboardSettings)

        // Check that all show* settings are true
        Object.keys(context.dashboardSettings).forEach((key) => {
          if (key.startsWith('show') && key !== 'showPrioritySection') {
            console.log(`key: ${key}, current value: ${String(context.dashboardSettings[key])}`)
            expect(context.dashboardSettings[key]).toBe(true, `dashboardSettings.${key}`)
          }
        })
      },
    },
    {
      name: `Set Dashboard Settings - Toggle Projects Section`,
      test: async (getContext: () => AppContextType): Promise<void> => {
        let context = getContext()
        const sendActionToPlugin = context.sendActionToPlugin
        const prevSetting = context.dashboardSettings.showProjectSection
        const newSetting = !prevSetting
        console.log(`Toggling Projects Section; was ${String(prevSetting)}; changing to ${String(newSetting)}`)
        const newDashboardSettings = {
          ...context.dashboardSettings,
          showProjectSection: newSetting,
          lastChange: `Changing showProjectSection setting to ${String(newSetting)}`,
        }

        sendDashboardSettingsToPlugin(sendActionToPlugin, newDashboardSettings, `Changing showProjectSection setting to ${String(newSetting)}`)

        // Wait for the dashboardSettings to update -- continue to wait until the condition is true (or default timeout of 5s)
        await waitFor(() => {
          return getContext().dashboardSettings.showProjectSection === newSetting
        }, 'dashboardSettings.showProjectSection')

        // waits for the condition to be true and if so, it passed.
        // we don't need to check the value because we already waited for the condition to be true, but it's just here for example
        expect(getContext().dashboardSettings.showProjectSection).toEqual(newSetting, 'dashboardSettings.showProjectSection')
      },
    },
  ],
}
