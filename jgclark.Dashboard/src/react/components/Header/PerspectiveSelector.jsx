// @flow
//--------------------------------------------------------------------------
// Dashboard React component to select and manage perspectives
// Called by DashboardSettings component.
// Last updated 2024-08-05 for v2.1.0.a3 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useState } from 'react'
import ComboBox from '../ComboBox.jsx'
import {
  // getCurrentPerspectiveDef,
  getListOfPerspectiveNames,
  getPerspectiveNamed,
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------


//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, setDashboardSettings } = useAppContext()

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  // We need to store the state of the ComboBox options and the active perspective name in local state so that we can
  // redraw the component if the options are changed outside of the component (e.g. in the settings dialog).
  // Set the initial state of the ComboBox options and the active perspective name to empty and we will update them in the
  // useEffect hook below.
  const [perspectiveNameOptions, setPerspectiveNameOptions] = useState<Array<string>>([])
  const [activePerspectiveName, setActivePerspectiveName] = useState<string>('')

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  useEffect(() => {
    // We set the initial options for the ComboBox to the list of perspective names from the dashboard settings here
    // We also watch for changes to dashboardSettings.perspectives (e.g. when a new perspective is added) so we can re-render 
    // the ComboBox with the updated list of perspective names.
    logDebug('PerspectiveSelector', 'useEffect called because dashboardSettings.perspectives changed')
    const options = getListOfPerspectiveNames(dashboardSettings, true)
    clo(options, 'PerspectiveSelector: new options')
    setPerspectiveNameOptions(options)
  }, [dashboardSettings.perspectives]) // dependencies: run any time this changes

  useEffect(() => {
    // TEST: is this needed, asks @dbw?
    const options = getListOfPerspectiveNames(dashboardSettings, true)
  // If a user changed the name of the active perspective in settings then our activePerspectiveName state will be out of date.
  // So we should first make sure the activePerspectiveName exists in the list of options before setting the combo box current value.
    const perspectiveNameIfItExists = dashboardSettings.activePerspectiveName ? options.find((option) => option === dashboardSettings.activePerspectiveName) : '-'
    logDebug('PerspectiveSelector', `useEffect: activePerspectiveName: ${dashboardSettings.activePerspectiveName}, perspectiveExists: ${perspectiveNameIfItExists ?? 'no'}`)
    if (activePerspectiveName !== perspectiveNameIfItExists) {
      logDebug('PerspectiveSelector', `useEffect: setting activePerspectiveName to ${perspectiveNameIfItExists ?? '-'}`)
      setActivePerspectiveName(perspectiveNameIfItExists ?? '-')
    }
  }, [activePerspectiveName]) // dependencies: run any time this changes

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  /**
   * Handler for when the perspective name is changed in the ComboBox.
   * @param {string} newValue - The new perspective name selected.
   */
  const handlePerspectiveChange = (newValue: string) => {
    logDebug('PerspectiveSelector', `handlePerspectiveChange called with newValue: ${newValue}. Saving to dashboardSettings.activePerspectiveName and local state`)
    setDashboardSettings((prev)=>({ ...prev, activePerspectiveName: newValue }))
    setActivePerspectiveName(newValue)

    // FIXME: issue is that dashboardSettings does not have excludedFolders, includedFolders etc.
    // Need to clear down the saved dashboardSettings entirely.

    // Actually change the settings
    const activePerspectiveDef = getPerspectiveNamed(newValue, dashboardSettings)
    if (!activePerspectiveDef) {
      logDebug('PerspectiveSelector', `⚠️ Cannot get activePerspectiveDef`)
    }
    clo(activePerspectiveDef, 'PerspectiveSelector: activePerspectiveDef')
    setDashboardSettings((prev) => ({ ...prev, ...activePerspectiveDef }))
    // beware race conditions, as we cannot await.
    clo(dashboardSettings, 'PerspectiveSelector: dashboardSettings')

    logDebug('PerspectiveSelector', `Hopefully the window will now magically React and refresh itself ...`)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (!perspectiveNameOptions.length) {
    return null
  }

  return (
    <ComboBox
      label={'Persp'}
      value={activePerspectiveName}
      onChange={handlePerspectiveChange}
      options={perspectiveNameOptions}
      compactDisplay={true}
    />
  )
}

export default PerspectiveSelector
