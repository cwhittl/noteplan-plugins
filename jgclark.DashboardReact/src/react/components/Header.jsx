// @flow
import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'
type Props = {
  lastUpdated: string,
}

/**
 * Displays the dashboard's header.
 */
const Header = ({ lastUpdated }: Props): React$Node => {
  const { reactSettings, setReactSettings, /*pluginData,*/ sendActionToPlugin /*, sendToPlugin, dispatch, pluginData, */ } = useAppContext()

  // Deal with timeAgo timer section
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastUpdated))
  useEffect(() => {
    const timer = setInterval(() => {
      if (reactSettings.refreshing) {
        setTimeAgo('Refreshing Data...')
      } else {
        setTimeAgo(getTimeAgo(lastUpdated))
      }
    }, 1000) // Update every 1s so it updates when data is updated

    return () => clearInterval(timer) // Clear interval on component unmount
  }, [lastUpdated, reactSettings])

  const handleCheckboxClick = (e: any) => {
    const isChecked = e?.target.checked || false
    logDebug('Header', `Checkbox clicked. setting in global Context reactSettings.filterPriorityItems to ${String(isChecked)}`)
    setReactSettings((prev) => ({ ...prev, filterPriorityItems: isChecked }))
  }

  const handleRefreshClick = () => {
    logDebug('Header', 'Refresh button clicked')
    sendActionToPlugin('onClickDashboardItem', { type: 'refresh' }, 'Refresh button clicked', true)
    setReactSettings((prev) => ({ ...prev, refreshing: true }))
  }

  return (
    <div className="header">
      <div className="lastUpdated">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>
      <Button
        text={
          <>
            <i className="fa-regular fa-arrow-rotate-right"></i> <span className="pad-left">Refresh</span>
          </>
        }
        clickHandler={handleRefreshClick}
        className="PCButton refreshButton"
      ></Button>
      <div className="totalCounts">
        <span id="totalDoneCount">0</span> items closed
      </div>
      <div>
        <input
          type="checkbox"
          className="apple-switch filterPriorityItems"
          onChange={handleCheckboxClick}
          name="filterPriorityItems"
          id="filterPriorityItems"
          checked={reactSettings?.filterPriorityItems || false}
        />
        <label htmlFor="filterPriorityItems">Filter out lower-priority items?</label>
      </div>
    </div>
  )
}

export default Header
