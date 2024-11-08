// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dropdown menu with display toggles.
// Called by Header component.
// Last updated 2024-08-27 for v2.1.a10 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, useCallback, type Node } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/DropdownMenu.css' // Import the CSS file
import { logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type SwitchStateMap = { [key: string]: boolean }

type DropdownMenuProps = {
  sectionItems?: Array<TSettingItem>,
  otherItems: Array<TSettingItem>,
  handleSwitchChange?: (key: string) => (e: any) => void,
  handleInputChange?: (key: string, e: any) => void,
  handleComboChange?: (key: string, e: any) => void,
  handleSaveInput?: (key: string) => (newValue: string) => void,
  onSaveChanges: (updatedSettings?: Object) => void,
  iconClass?: string,
  className?: string,
  labelPosition?: 'left' | 'right',
  isOpen: boolean,
  toggleMenu: () => void,
}

//--------------------------------------------------------------------------
// DropdownMenu Component Definition
//--------------------------------------------------------------------------

const DropdownMenu = ({
  sectionItems = [],
  otherItems,
  handleSwitchChange = (key: string) => (e: any) => {},
  handleInputChange = (_key, _e) => {},
  handleComboChange = (_key, _e) => {},
  handleSaveInput = (key: string) => (newValue: string) => {},
  onSaveChanges,
  iconClass = 'fa-solid fa-filter',
  className = '',
  labelPosition = 'right',
  isOpen,
  toggleMenu,
}: DropdownMenuProps): Node => {
  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const dropdownRef = useRef<?HTMLDivElement>(null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)
  const [localSwitchStates, setLocalSwitchStates] = useState<SwitchStateMap>(() => {
    const initialStates: SwitchStateMap = {}
    ;[...otherItems, ...sectionItems].forEach((item) => {
      if (item.type === 'switch' && item.key) {
        initialStates[item.key] = item.checked || false
      }
    })
    return initialStates
  })

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleFieldChange = (key: string, value: any) => {
    logDebug('DropdownMenu', `menu:"${className}" Field change detected for ${key} with value ${value}`)
    setChangesMade(true)
    setLocalSwitchStates((prevStates) => ({
      ...prevStates,
      [key]: value,
    }))
  }

  const handleSaveChanges = useCallback(() => {
    logDebug('DropdownMenu/handleSaveChanges:', `menu:"${className}"  changesMade = ${String(changesMade)}`)
    if (changesMade && onSaveChanges) {
      logDebug(
        'DropdownMenu',
        `handleSaveChanges: calling onSaveChanges with filterPriorityItems=${JSON.stringify(
          localSwitchStates.filterPriorityItems,
        )} localSwitchStates.filterPriorityItems=${JSON.stringify(localSwitchStates.filterPriorityItems)}`,
      )
      onSaveChanges(localSwitchStates)
    }
    setChangesMade(false)
    toggleMenu()
  }, [changesMade, localSwitchStates, onSaveChanges, toggleMenu])

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      logDebug('DropdownMenu', 'Escape key detected')
      handleSaveChanges()
    }
  }

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const isOutsideMenu = dropdownRef.current && !dropdownRef.current.contains((event.target: any))
      logDebug('DropdownMenu', `menu:"${className}" click detected; isOutsideMenu=${String(isOutsideMenu)} changesMade=${String(changesMade)} `)
      if (isOutsideMenu) {
        logDebug('DropdownMenu', `menu:"${className}" Click outside detected and closing dropdown`)
        handleSaveChanges()
      }
    },
    [changesMade, handleSaveChanges, dropdownRef],
  )

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, handleSaveChanges])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className={`dropdown ${className}`} ref={dropdownRef}>
      <i className={iconClass} onClick={toggleMenu} onClick={handleSaveChanges}></i>
      <div className={`dropdown-content  ${isOpen ? 'show' : ''}`}>
        <div className="changes-pending">{changesMade ? `Changes pending. Will be applied when you close the menu.` : ''}</div>
        <div className="column">
          {otherItems.map((item, index) =>
            renderItem({
              index,
              item: { ...item, checked: localSwitchStates[item.key] },
              labelPosition,
              handleFieldChange,
              handleInputChange,
              handleComboChange,
              handleSaveInput,
              showDescAsTooltips: true,
            }),
          )}
        </div>
        {sectionItems.length > 0 && (
          <div className="column">
            {sectionItems.map((item, index) =>
              renderItem({
                index,
                item: { ...item, checked: localSwitchStates[item.key] },
                labelPosition,
                handleFieldChange,
                handleInputChange,
                handleComboChange,
                handleSaveInput,
                showDescAsTooltips: true,
              }),
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DropdownMenu
