// @flow
//--------------------------------------------------------------------------
// Dashboard React component to select and manage perspectives
// Refactored to use useReducer to give more visibility into what's happening
// Prevents infinite render loops by avoiding returning null
// Last updated 2024-10-17
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useReducer, useEffect, useCallback } from 'react'
import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import { setActivePerspective } from '../../../perspectiveHelpers'
import DropdownSelect, { type Option } from '../../../../../np.Shared/src/react/DynamicDialog/DropdownSelect'
// import ThemedSelect from '../../../../../np.Shared/src/react/DynamicDialog/ThemedSelect'

import {
  cleanDashboardSettings,
  getDisplayListOfPerspectiveNames,
  getPerspectiveNamed,
  getActivePerspectiveDef,
  getActivePerspectiveName,
  type TPerspectiveOptionObject,
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug, logWarn, logError } from '@helpers/react/reactDev.js'
import { compareObjects, dt } from '@helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type State = {
  perspectiveNameOptions: Array<TPerspectiveOptionObject>,
  activePerspectiveName: string,
}

type Action =
  | { type: 'SET_PERSPECTIVE_OPTIONS', payload: Array<TPerspectiveOptionObject> }
  | { type: 'SET_ACTIVE_PERSPECTIVE', payload: string }
  | { type: 'SAVE_PERSPECTIVE', payload: null }
  | { type: 'LOG_STATE', payload: string }

const separatorOption = [{ label: '-------------------------------', value: '_separator_' }]

const saveAsOption = [{ label: 'Save Perspective As...', value: 'Add New Perspective' }]

/**
 * Formats the name of a perspective or option by appending an asterisk if it is modified.
 *
 * @param {Object} item - The perspective or option object.
 * @param {string} item.name - The name of the perspective or option.
 * @param {boolean} item.isModified - Indicates if the perspective or option is modified.
 * @returns {string} The formatted name.
 */
const formatNameWithStarIfModified = (item: { name: string, isModified: boolean, [string]: mixed }): string => {
  return item.isModified ? `${item.name}*` : item.name
}

//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, perspectiveSettings, dispatchDashboardSettings, dispatchPerspectiveSettings, sendActionToPlugin } = useAppContext()

  //--------------------------------------------------------------------------
  // Reducer Function with Comprehensive Logging
  //--------------------------------------------------------------------------
  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_PERSPECTIVE_OPTIONS': {
        logDebug('PerspectiveSelector Reducer', `Action: SET_PERSPECTIVE_OPTIONS`)
        // Access activePerspectiveName from the current state
        const { activePerspectiveName } = state

        // Determine if "Save Perspective" should be included
        const thisPersp = getActivePerspectiveDef(perspectiveSettings)
        const saveModifiedOption = thisPersp?.isModified ? [{ label: 'Save Perspective', value: 'Save Perspective' }] : []
        const deletePersp = activePerspectiveName && activePerspectiveName !== '-' ? [{ label: 'Delete Perspective', value: 'Delete Perspective' }] : []
        return {
          ...state,
          perspectiveNameOptions: [...action.payload, ...separatorOption, ...saveModifiedOption, ...saveAsOption, ...deletePersp],
        }
      }
      case 'SET_ACTIVE_PERSPECTIVE':
        logDebug('PerspectiveSelector Reducer', `Action: SET_ACTIVE_PERSPECTIVE, Payload: ${action.payload}`)
        return {
          ...state,
          activePerspectiveName: action.payload,
        }

      case 'LOG_STATE':
        logDebug('PerspectiveSelector Reducer', `Action: LOG_STATE, Message: ${action.payload}`)
        return state

      default:
        logWarn('PerspectiveSelector Reducer', `Unhandled action type: ${action.type}`)
        return state
    }
  }

  //----------------------------------------------------------------------
  // Reducer Initialization
  //----------------------------------------------------------------------
  const initialState: State = {
    perspectiveNameOptions: [],
    activePerspectiveName: getActivePerspectiveName(perspectiveSettings) || '-',
  }

  const [state, dispatchPerspectiveSelector] = useReducer(reducer, initialState)
  const { perspectiveNameOptions, activePerspectiveName } = state

  //----------------------------------------------------------------------
  // Effect to Update Perspective Options When perspectiveSettings Change
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `Detected change in perspectiveSettings.`)
    if (!perspectiveSettings) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'perspectiveSettings is falsy. Exiting effect.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'perspectiveSettings is falsy' })
      return
    }

    // Get list of perspective names
    const options: Array<TPerspectiveOptionObject> = getDisplayListOfPerspectiveNames(perspectiveSettings, true)
    logDebug(
      'PerspectiveSelector/useEffect(perspectiveSettings)',
      `Retrieved perspective options ${getActivePerspectiveDef(perspectiveSettings)?.dashboardSettings?.excludedFolders || ''}`,
    )

    if (!options || options.length === 0) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'Options derived from perspectiveSettings are empty or falsy.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'Options derived from perspectiveSettings are empty or falsy.' })
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: [] })
      return
    }

    // Update perspective options first
    dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: options })

    // Then derive the active perspective name
    const newActivePerspectiveName = getActivePerspectiveName(perspectiveSettings)
    if (newActivePerspectiveName !== activePerspectiveName) {
      logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `Active perspective changed to: "${newActivePerspectiveName}"`)
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: newActivePerspectiveName })
    }
  }, [perspectiveSettings])

  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------

  // Ensure activePerspectiveName is updated when perspectiveSettings change
  useEffect(() => {
    const thisPersp = getActivePerspectiveDef(perspectiveSettings)
    if (thisPersp && thisPersp.name !== activePerspectiveName) {
      logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `Updating activePerspectiveName to: "${thisPersp.name}"`)
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: thisPersp.name })
    }
  }, [perspectiveSettings, activePerspectiveName])

  //----------------------------------------------------------------------
  // Effect to Log State Changes (Optional, for Debugging)
  //----------------------------------------------------------------------
  useEffect(() => {
    const thisPersp = getActivePerspectiveDef(perspectiveSettings)
    logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `FYI: State updated: activePerspectiveName="${formatNameWithStarIfModified(thisPersp)}"`)
  }, [perspectiveNameOptions, activePerspectiveName])

  //----------------------------------------------------------------------
  // Handler for Perspective Change with Comprehensive Logging
  //----------------------------------------------------------------------

  const handlePerspectiveChange = useCallback(
    (selectedOption: Option) => {
      logDebug('PerspectiveSelector/handlePerspectiveChange', `User selected newValue: "${selectedOption.value}". Current activePerspectiveName: "${activePerspectiveName}".`)

      if (selectedOption.value === 'separator') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `newValue "${selectedOption.value}" is the same as activePerspectiveName. No action taken.`)
        return
      }

      if (selectedOption.value === 'Add New Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `newValue "${selectedOption.value}".`)
        sendActionToPlugin(
          'addNewPerspective',
          { actionType: 'addNewPerspective', logMessage: 'Add New Perspective selected from dropdown' },
          'Add New Perspective selected from dropdown',
        )
        return
      }

      if (selectedOption.value === 'Delete Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `newValue "${selectedOption.value}".`)
        sendActionToPlugin(
          'deletePerspective',
          { actionType: 'deletePerspective', perspectiveName: activePerspectiveName, logMessage: `Delete  Perspective (${activePerspectiveName}) selected from dropdown` },
          `Delete  Perspective (${activePerspectiveName}) selected from dropdown`,
        )
        return
      }

      if (selectedOption.value === 'Save Perspective') {
        const perspName = state.activePerspectiveName
        const thisPersp = getActivePerspectiveDef(perspectiveSettings)
        if (thisPersp && thisPersp.isModified && thisPersp.name !== '-') {
          sendActionToPlugin(
            'savePerspective',
            { actionType: 'savePerspective', perspectiveName: thisPersp.name, logMessage: `Save Perspective (${thisPersp.name}) selected from dropdown` },
            `Save Perspective (${thisPersp.name}) selected from dropdown`,
          )
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp.name} saved!`)
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp?.name || ''} was not modified. Not saving.`)
        }
        return
      }

      // Otherwise, it's a normal perspective change so we process it
      // but not if the option changed only because the plugin sent it to us (no user action)
      const apn = getActivePerspectiveName(perspectiveSettings)
      if (selectedOption.value !== apn) {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `Switching to perspective "${selectedOption.value}" sendActionToPlugin: "switchToPerspective"`)
        sendActionToPlugin(
          'switchToPerspective',
          { perspectiveName: selectedOption.value, actionType: 'switchToPerspective', logMessage: `Perspective changed to ${selectedOption.value}` },
          `Perspective changed to ${selectedOption.value}`,
        )
      } else {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `newValue "${selectedOption.value}" is the same as activePerspectiveName. No action taken.`)
      }
    },
    [perspectiveSettings, state, activePerspectiveName, dashboardSettings],
  )

  //----------------------------------------------------------------------
  // Render Logic with Comprehensive Logging
  //----------------------------------------------------------------------

  if (!perspectiveNameOptions.length) {
    logDebug('PerspectiveSelector', 'perspectiveNameOptions is empty. Rendering disabled ComboBox.')
    return (
      <div>
        <label htmlFor="perspective-select">Persp</label>
        <select id="perspective-select" disabled>
          <option>No Perspectives Available</option>
        </select>
      </div>
    )
  }

  const customStyles = {
    container: {
      minWidth: '45px',
      width: '51px', // Half the default width of 400px
      height: '21px', // Three-quarters the default height of 60px
    },
  }

  const normalizedOptions: Array<TPerspectiveOptionObject> = perspectiveNameOptions
    ? perspectiveNameOptions.map((option) => (typeof option === 'string' ? { label: option, value: option } : option))
    : []
  const thisPersp = getPerspectiveNamed(activePerspectiveName, perspectiveSettings)
  if (!thisPersp) {
    logError('PerspectiveSelector', `Cannot find perspective definition for: "${activePerspectiveName}". Was it just created externally?".`)
    return
  }
  const nameToDisplay = thisPersp ? formatNameWithStarIfModified(thisPersp) : '-'
  const selectedValue = { label: nameToDisplay, value: activePerspectiveName || '-' }
  // logDebug('PerspectiveSelector', `selectedValue: ${JSON.stringify(selectedValue)} value(activePerspectiveName)=${activePerspectiveName}`)
  return (
    <DropdownSelect
      style={customStyles}
      options={normalizedOptions}
      // value={normalizedOptions.find(o=>o.value === activePerspectiveName)?.label||''} // show the star if it's modified
      value={selectedValue || { label: '-', value: '-' }} // show the star if it's modified
      onChange={handlePerspectiveChange}
      compactDisplay={true}
      label={'Persp'}
      noWrapOptions={false}
    />
  )
}

export default PerspectiveSelector
