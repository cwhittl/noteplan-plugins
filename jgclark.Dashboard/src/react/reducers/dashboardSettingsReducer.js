// @flow
import type { TDashboardSettings } from '../../../src/types'
import { DASHBOARD_ACTIONS } from './actionTypes'
import { compareObjects } from '@helpers/dev'
import { logDebug, logError } from '@helpers/react/reactDev'

export type TDashboardSettingsAction = {
  type: $Values<typeof DASHBOARD_ACTIONS>,
  payload: Partial<TDashboardSettings>, // Overwrites existing properties of supplied object
  reason?: string,
}

/**
 * Reducer for managing dashboard settings
 * @param {*} state
 * @param {*} action
 * @returns TDashboardSettings
 */
export function dashboardSettingsReducer(state: TDashboardSettings, action: TDashboardSettingsAction): TDashboardSettings {
  const { type, payload, reason } = action
  logDebug('dashboardSettingsReducer', `${type} "${reason || ''}" - payload: ${JSON.stringify(payload)}`)
  switch (type) {
    case DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS: {
      const changedProps = compareObjects(state, payload)
      logDebug('dashboardSettingsReducer', `${type} "${reason || ''}" - Changed properties: ${JSON.stringify(changedProps)}`)
      return {
        ...state,
        ...payload,
        lastChange: reason || '',
      }
    }
    default:
      logError('AppContext/dashboardSettingsReducer', `Unhandled action type: ${type}`)
      return state
  }
}
