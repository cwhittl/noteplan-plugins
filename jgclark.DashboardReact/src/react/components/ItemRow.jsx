/**
 * ItemRow.jsx
 * Represents a row item within a section.
 * Could be: Task, Review Item, Filtered Indicator, or No Tasks Left
 */
// @flow
import * as React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
// import { useAppContext } from './AppContext.jsx'
import ReviewItem from './ReviewItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import NoTasks from './NoTasks.jsx'
import { logDebug } from '@helpers/react/reactDev'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a row item within a section.
 * Loads the proper Component depending on itemType
 */
function ItemRow({ item, thisSection }: Props): React.Node {
  logDebug(`ItemRow`, `csection ${thisSection.sectionType}/${thisSection.ID}${thisSection.sectionFilename} && ${typeof item !== 'undefined' ? item.itemNoteTitle : '<no item>'}`)
  const { itemType } = item

  return (
    <>
      {itemType === 'review' ? (
        <ReviewItem item={item} />
      ) : itemType === 'filterIndicator' ? (
        <TasksFiltered item={item} />
      ) : itemType === 'congrats' ? (
        <NoTasks />
      ) : (
        <TaskItem item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
