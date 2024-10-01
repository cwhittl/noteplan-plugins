/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
//
// The major part is creating HTML view for the review list.
// This doesn't require any comms back to the plugin through bridges;
// all such activity happens via x-callback calls for simplicity.
///
// It draws its data from an intermediate 'full review list' CSV file, which is (re)computed as necessary.
//
// by @jgclark
// Last updated 2024-09-29 for v1.0.0.b1, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter'
import pluginJson from '../plugin.json'
import {
  logAvailableSharedResources, logProvidedSharedResources
} from '../../np.Shared/src/index.js'
import {
  getReviewSettings,
  type ReviewConfig,
  updateDashboardIfOpen,
} from './reviewHelpers'
import { Project } from './projectClass'
import {
  clo, JSP, logDebug, logError, logInfo, logTimer, logWarn,
} from '@helpers/dev'
import { getFoldersMatching, getFolderListMinusExclusions } from '@helpers/folders'
import {
  displayTitle
} from '@helpers/general'
import {
  filterOutProjectNotesFromExcludedFolders,
} from '@helpers/note'
import { findNotesMatchingHashtag } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${pluginID}/full-review-list.md` // to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const allProjectsListFilename = `../${pluginID}/allProjectsList.json` // to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const maxAgeAllProjectsListInHours = 1
const generatedDatePrefName = 'Reviews-lastAllProjectsGenerationTime'
//-------------------------------------------------------------------------------

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export async function logFullReviewList(): Promise<void> {
  const content = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
  console.log(`Contents of ${fullReviewListFilename}:\n${content}`)
}

function stringifyProjectObjects(objArray: Array<any>): string {
  /**
   * a function for JSON.stringify to pass through all except .note property
   * @returns {any}
   */
  function stringifyReplacer(key: string, value: any) {
    // Filtering out properties
    if (key === "note") {
      return undefined
    }
    return value
  }
  const output = JSON.stringify(objArray, stringifyReplacer, 0).replace(/},/g, '},\n')
  return output
}

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export async function logAllProjectsList(): Promise<void> {
  const content = DataStore.loadData(allProjectsListFilename, true) ?? `<error reading ${allProjectsListFilename}>`
  const allProjects = JSON.parse(content)
  console.log(`Contents of Projects List (JSON):`)
  console.log(stringifyProjectObjects(allProjects))
}

/**
 * Return all projects as Project instances, that match config items 'noteTypeTags'.
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground?
 * @returns {Promise<Array<Project>>}
 */
async function getAllMatchingProjects(configIn: any, runInForeground: boolean = false): Promise<Array<Project>> {

  const config = configIn ? configIn : await getReviewSettings() // get config from passed config if possible
  if (!config) throw new Error('No config found. Stopping.')

  logDebug('getAllMatchingProjects', `Starting for tags [${String(config.noteTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)
  const startTime = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

  // Get list of folders, excluding @specials and our foldersToInclude or foldersToIgnore settings -- include takes priority over ignore.
  const filteredFolderList = (config.foldersToInclude.length > 0)
    ? getFoldersMatching(config.foldersToInclude, true).sort()
    : getFolderListMinusExclusions(config.foldersToIgnore, true, false).sort()
  // For filtering DataStore, no need to look at folders which are in other folders on the list already
  const filteredFolderListWithoutSubdirs = filteredFolderList.reduce((acc: Array<string>, f: string) => {
    const exists = acc.some((s) => f.startsWith(s))
    if (!exists) acc.push(f)
    return acc
  }, [])
  // logDebug('getAllMatchingProjects', `- filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

  // filter DataStore one time, searching each item to see if it startsWith an item in filterFolderList
  // but need to deal with ignores here because of this optimization (in case an ignore folder is inside an included folder)
  // TODO: make the excludes an includes not startsWith
  let filteredDataStore = DataStore.projectNotes.filter(
    (f) => filteredFolderListWithoutSubdirs.some((s) => f.filename.startsWith(s)) && !config.foldersToIgnore.some((s) => f.filename.includes(`${s}/`.replace('//', '/')))
  )
  // Above ignores root notes, so if we have '/' folder, now need to add them
  if (filteredFolderListWithoutSubdirs.includes('/')) {
    const rootNotes = DataStore.projectNotes.filter((f) => !f.filename.includes('/'))
    filteredDataStore = filteredDataStore.concat(rootNotes)
    // logDebug('getAllMatchingProjects', `Added root folder notes: ${rootNotes.map((n) => n.title).join(' / ')}`)
  }

  logTimer(`getAllMatchingProjects`, startTime, `- filteredDataStore: ${filteredDataStore.length} potential project notes`)

  if (runInForeground) {
    CommandBar.showLoading(true, `Generating Project Review list`)
    // TODO: work out what to do about this: currently commented this out as it gives warnings because Editor is accessed.
    // await CommandBar.onAsyncThread()
  }

  // Iterate over the folders, using settings from config.foldersToProcess and config.foldersToIgnore list
  const projectInstances = []
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use []
    const tags = config.noteTypeTags != null && config.noteTypeTags.length > 0 ? config.noteTypeTags : []

    // Get notes that include noteTag in this folder, ignoring subfolders
    // Note: previous method using (plural) findNotesMatchingHashtags can't distinguish between a note with multiple tags of interest
    for (const tag of tags) {
      logDebug('getAllMatchingProjects', `looking for tag '${tag}' in project notes in folder '${folder}'...`)
      // Note: this is very quick <1ms
      const projectNotesArr = findNotesMatchingHashtag(tag, folder, false, [], true, filteredDataStore, false)
      if (projectNotesArr.length > 0) {
        // Get Project class representation of each note.
        // Save those which are ready for review in projectsReadyToReview array
        for (const n of projectNotesArr) {
          const np = new Project(n, tag, true, config.nextActionTag)
          projectInstances.push(np)
        }
      }
    }
  }
  if (runInForeground) {
    // await CommandBar.onMainThread()
    CommandBar.showLoading(false)
  }
  logTimer('getAllMatchingProjects', startTime, `- found ${projectInstances.length} available project notes`)
  return projectInstances
}

/**
 * Generate JSON representation of all project notes as Project objects that match the main folder and 'noteTypeTags' settings.
 * Not ordered in any particular way.
 * Output is written to file location set by `allProjectsListFilename`.
 * Note: This is V1 for JSON, borrowing from makeFullReviewList v3
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground? (default: false)
 * @returns {Promise<Array<Project>>} Object containing array of all Projects, the same as what was written to disk
 */
export async function generateAllProjectsList(configIn: any, runInForeground: boolean = false): Promise<Array<Project>> {
  try {
    logDebug('generateAllProjectsList', `starting`)
    const startTime = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    // Get all project notes as Project instances
    const projectInstances = await getAllMatchingProjects(configIn, runInForeground)

    writeAllProjectsList(projectInstances)
    return projectInstances
  } catch (error) {
    logError('generateAllProjectsList', JSP(error))
    return []
  }
}

export function writeAllProjectsList(projectInstances: Array<Project>): void {
  try {
    logDebug('writeAllProjectsList', `starting`)

    // write summary to allProjects JSON file, using a replacer to suppress .note
    logDebug('writeAllProjectsList', `Writing ${projectInstances.length} projects to ${allProjectsListFilename}`)
    const res = DataStore.saveData(stringifyProjectObjects(projectInstances), allProjectsListFilename, true)

    // If this appears to have worked:
    // - update the datestamp of the Reviews preference
    // - refresh Dashboard if open
    if (res) {
      const reviewListDate = Date.now()
      DataStore.setPreference(generatedDatePrefName, reviewListDate)
      updateDashboardIfOpen()
    } else {
      logWarn(`writeAllProjectsList`, `Seems to be a problem saving JSON to '${allProjectsListFilename}'`)
    }
  } catch (error) {
    logError('writeAllProjectsList', JSP(error))
  }
}

/**
 * Update the Project object in allProjects list with matching filename
 * @author @jgclark
 * @param {Project} projectToUpdate
 */
export async function updateProjectInAllProjectsList(projectToUpdate: Project): Promise<void> {
  try {
    const allProjects = await getAllProjectsFromList()
    logDebug('updateProjectInAllProjectsList', `starting with ${allProjects.length} projectInstances`)

    // find the Project with matching filename
    const projectIndex = allProjects.findIndex((project) => project.filename === projectToUpdate.filename)
    allProjects[projectIndex] = projectToUpdate
    logDebug('updateProjectInAllProjectsList', `- will update project #${projectIndex} filename ${projectToUpdate.filename}`)

    // write to allProjects JSON file
    logDebug('updateProjectInAllProjectsList', `Writing ${allProjects.length} projects to ${allProjectsListFilename}`)
    writeAllProjectsList(allProjects)
  } catch (error) {
    logError('updateProjectInAllProjectsList', JSP(error))
  }
}

/**
 * Get all Project object instances from JSON list of all available project notes. Doesn't come ordered.
 * First checks to see how old the list is, and re-generates more than 'maxAgeAllProjectsListInHours' hours old.
 * @author @jgclark
 * @returns {Promise<Array<Project>>} allProjects Object, the same as what is written to disk
 */
export async function getAllProjectsFromList(): Promise<Array<Project>> {
  try {
    const startTime = new moment().toDate()
    let projectInstances: Array<Project>

    // But first check to see if it is more than a day old
    if (DataStore.fileExists(allProjectsListFilename)) {
      // read this from a NP preference
      // $FlowFixMe[incompatible-call]
      const reviewListDate = new Date(DataStore.preference(generatedDatePrefName) ?? 0)
      const fileAge = Date.now() - reviewListDate
      logDebug('getAllProjectsFromList', `- reviewListDate = ${String(reviewListDate)} = ${String(fileAge)} ago`)
      // If this note is more than a day old, then regenerate it
      if (fileAge > (1000 * 60 * 60 * maxAgeAllProjectsListInHours)) {
        logDebug('getAllProjectsFromList', `Regenerating allProjects list as more than ${String(maxAgeAllProjectsListInHours)} hours old`)
        // Call plugin command generateAllProjectsList (which produces the newer JSON file)
        projectInstances = await generateAllProjectsList()
      } else {
        // Otherwise we can read from the list
        logDebug('getAllProjectsFromList', `Reading from allProjectsList (as only ${(fileAge / (1000 * 60 * 60)).toFixed(2)} hours old)`)
        const content = DataStore.loadData(allProjectsListFilename, true) ?? `<error reading ${allProjectsListFilename}>`
        // Make objects from this (except .note)
        projectInstances = JSON.parse(content)
      }
    } else {
      // Need to generate it
      logDebug('getAllProjectsFromList', `Generating allProjects list as can't find it`)
      projectInstances = await generateAllProjectsList()
    }
    logTimer(`getAllProjectsFromList`, startTime, `- read ${projectInstances.length} Projects from allProjects list`)

    return projectInstances
  }
  catch (error) {
    logError(pluginJson, `generateAllProjectsList: ${error.message}`)
    return []
  }
}

/**
 * Get the Project object instance from JSON list that matches by filename.
 * TEST:
 * @author @jgclark
 * @param {string} filename
 * @returns {Project}
 */
export async function getSpecificProjectFromList(filename: string): Promise<Project | null> {
  try {
    const allProjects = await getAllProjectsFromList() ?? []
    logDebug(`getSpecificProjectFromList`, `- read ${String(allProjects.length)} Projects from allProjects list`)

    // find the Project with matching filename
    const projectInstance: ?Project = allProjects.find((project) => project.filename === filename)
    logDebug(`getSpecificProjectFromList`, `- read ${String(allProjects.length)} Projects from allProjects list`)
    // $FlowFixMe[incompatible-return]
    return projectInstance
  }
  catch (error) {
    logError(pluginJson, `getSpecificProjectFromList: ${error.message}`)
    return null
  }
}

/**
 * 
 * @param {ReviewConfig} config 
 * @returns 
 */
export async function filterAndSortProjectsList(config: ReviewConfig): Promise<Array<Project>> {
  try {
    // const startTime = new Date()
    let projectInstances = await getAllProjectsFromList()
    logDebug('filterAndSortProjectsList', `Starting for ${projectInstances.length} projects ...`)

    // Filter out finished projects if required
    // const displayFinished = DataStore.preference('Reviews-displayFinished' ?? 'display at end')
    const displayFinished = config.displayFinished ?? 'display at end'
    if (displayFinished === 'hide') {
      projectInstances = projectInstances.filter((pi) => !pi.isCompleted)
      logDebug('filterAndSortProjectsList', `- after filtering out finished, ${projectInstances.length} projects`)
    }

    // Filter out non-due projects if required
    // const displayOnlyDue = DataStore.preference('Reviews-displayOnlyDue' ?? false)
    const displayOnlyDue = config.displayOnlyDue ?? false
    if (displayOnlyDue) {
      projectInstances = projectInstances.filter((pi) => pi.nextReviewDays <= 0)
      logDebug('filterAndSortProjectsList', `- after filtering out non-due, ${projectInstances.length} projects`)
    }

    // Sort projects by folder > nextReviewDays > dueDays > title
    const sortingSpecification = []
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('nextReviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }
    if (displayFinished === 'display at end') {
      sortingSpecification.push('-isCompleted') // i.e. 'active' before 'finished'
    }
    logDebug('filterAndSortProjectsList', `- sorting by ${String(sortingSpecification)}`)
    const sortedProjectInstances = sortListBy(projectInstances, sortingSpecification)
    // sortedProjectInstances.forEach(pi => logDebug('', `${pi.nextReviewDays}\t${pi.dueDays}\t${pi.filename}`))

    // logTimer(`filterAndSortProjectsList`, startTime, `Sorted ${sortedProjectInstances.length} projects`) // 2ms
    return sortedProjectInstances
  }
  catch (error) {
    logError('filterAndSortProjectsList', `error: ${error.message}`)
    return []
  }
}

/**
 * Take a set of TSVSummaryLines, filter if required by 'displayFinished' setting, sort them according to config, and then add frontmatter
 * Note: this isn't a very sensible way of operating: in/out of TSV.
 * @param {Array<string>} linesIn
 * @param {any} config
 * @returns {Array<string>} outputArray
 */
export function filterAndSortReviewList(linesIn: Array<string>, config: any): Array<string> {
  try {
    logDebug('filterAndSortReviewList', `Starting with ${linesIn.length} lines`)
    const outputArray = []
    let lineArrayObjs = []

    // turn each TSV string into an object
    for (const line of linesIn) {
      const fields = line.split('\t')
      lineArrayObjs.push({
        reviewDays: fields[0],
        dueDays: fields[1],
        title: fields[2],
        folder: fields[3],
        tags: fields[4],
        state: fields[5],
      })
    }

    // Filter out finished projects if required
    // const displayFinished = DataStore.preference('Reviews-displayFinished' ?? 'display at end')
    const displayFinished = config.displayFinished ?? 'display at end'
    if (displayFinished === 'hide') {
      lineArrayObjs = lineArrayObjs.filter((lineObj) => !lineObj.state.match('finished'))
    }

    // Sort projects
    // Method 3: use DW fieldSorter() function
    // Requires turning each TSV line into an Object (above)
    const sortingSpecification = []
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('reviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }
    if (displayFinished === 'display at end') {
      sortingSpecification.push('state') // i.e. 'active' before 'finished'
    }

    // Method 2: use lodash _.orderBy() function
    // Requires turning each TSV line into an Object (above)
    // Note: Crashes for some reason neither DW or I can understand.
    // clo(lineArrayObjs, "Before orderBy")
    // if (lineArrayObjs) {
    //   lineArrayObjs = orderBy(lineArrayObjs, ['folder', 'reviewDays'], ['asc', 'asc'])
    //   clo(lineArrayObjs, "After orderBy")
    // }
    // // turn lineArrayObjs back to a TSV string
    // for (let lineObj of lineArrayObjs) {
    //   outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    // }

    logDebug('filterAndSortReviewList', `- sorting by ${String(sortingSpecification)} ...`)
    const sortedlineArrayObjs = sortListBy(lineArrayObjs, sortingSpecification)

    // turn each lineArrayObj back to a TSV string
    for (const lineObj of sortedlineArrayObjs) {
      outputArray.push(`${lineObj.reviewDays}\t${lineObj.dueDays}\t${lineObj.title}\t${lineObj.folder}\t${lineObj.tags}\t${lineObj.state}`)
    }

    // Write some metadata to start
    outputArray.unshift('---')
    outputArray.unshift(`key: reviewDays\tdueDays\ttitle\tfolder\ttags\tstate`)
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift('title: full-review-list')
    outputArray.unshift('---')

    return outputArray
  } catch (error) {
    logError('filterAndSortReviewList', error.message)
    return [] // for completeness
  }
}

//-------------------------------------------------------------------------------

/**
 * TEST:
 * Update the allProjects list after completing a review or completing/cancelling a whole project.
 * Note: Called by nextReview, skipReview, skipReviewForNote, completeProject, cancelProject, pauseProject.
 * @author @jgclark
 * @param {string} filename of note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {any} config
list (optional)
 */
export async function updateProjectsListAfterChange(
  // reviewedTitle: string,
  reviewedFilename: string,
  simplyDelete: boolean,
  config: any,
): Promise<void> {
  try {
    if (reviewedFilename === '') {
      throw new Error('Empty filename passed')
    }
    logInfo('updateProjectsListAfterChange', `--------- ${simplyDelete ? 'simplyDelete' : 'update'} for '${reviewedFilename}'`)

    // Get contents of full-review-list
    let allProjects = await getAllProjectsFromList()

    // Find right project to update
    const reviewedProject = allProjects.find((project) => project.filename === reviewedFilename)
    if (!reviewedProject) {
      logWarn('updateProjectsListAfterChange', `Couldn't find '${reviewedFilename}' to update in allProjects list, so will regenerate whole list.`)
      await generateAllProjectsList(config, false)
      return
    }

    const reviewedTitle = reviewedProject.title ?? 'error'
    logInfo('updateProjectsListAfterChange', `- Found '${reviewedTitle}' to update in allProjects list`)

    // delete this item from the list
    allProjects = allProjects.filter((project) => project.filename !== reviewedFilename)
    logInfo('updateProjectsListAfterChange', `- Deleted Project '${reviewedTitle}'`)

    // unless we simply need to delete, add updated item back into the list
    if (!simplyDelete) {
      const reviewedNote = await DataStore.noteByFilename(reviewedFilename, "Notes")
      if (!reviewedNote) {
        logWarn('updateProjectsListAfterChange', `Couldn't find '${reviewedFilename}' to update in allProjects list`)
        return
      }
      // FIXME: stale data here
      const updatedProject = new Project(reviewedNote, reviewedProject.noteType, true, config.nextActionTag)
      clo(updatedProject, '🟡 updatedProject:')
      allProjects.push(updatedProject)
      logInfo('updateProjectsListAfterChange', `- Added Project '${reviewedTitle}'`)
    }
    // re-form the file
    writeAllProjectsList(allProjects)
    logInfo('updateProjectsListAfterChange', `- Wrote  ${allProjects.length} items toupdated list`)

    // Finally, refresh Dashboard
    updateDashboardIfOpen()
  }
  catch (error) {
    logError('updateProjectsListAfterChange', JSP(error))
  }
}

/**
 * Note: v1 -- now DEPRECATED.
 * Update the full-review-list after completing a review or completing/cancelling a whole project.
 * Note: Called by nextReview, skipReview, skipReviewForNote, completeProject, cancelProject, pauseProject.
 * @author @jgclark
 * @param {string} title of note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {any} config
 * @param {string?} updatedTSVSummaryLine to write to full-review-list (optional)
 */
export async function updateReviewListAfterChangeV1(
  reviewedTitle: string,
  simplyDelete: boolean,
  configIn: any,
  updatedTSVSummaryLine: string = '',
): Promise<void> {
  try {
    if (reviewedTitle === '') {
      throw new Error('Empty title passed')
    }
    logInfo('updateReviewListAfterChange', `----------------------- Updating full-review-list\nfor '${reviewedTitle}' -> ${simplyDelete ? 'simplyDelete' : 'update'} with '${updatedTSVSummaryLine}'`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(configIn, true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    // const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n')
    // const firstLineAfterFrontmatter = fmObj.bodyBegin - 1

    // Find right line to update
    let thisLineNum: number = NaN
    // let thisTitle = ''
    // for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
    for (let i = 0; i < reviewLines.length; i++) {
      // const line = fileLines[i]
      const line = reviewLines[i]
      // check for title match just using field 3
      const titleField = line.split('\t')[2] ?? ''
      if (titleField === reviewedTitle) {
        thisLineNum = i
        // thisTitle = reviewedTitle
        logDebug('updateReviewListAfterChange', `- Found '${reviewedTitle}' to update from '${line}' at line number ${String(thisLineNum)}`)
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    if (isNaN(thisLineNum)) {
      logWarn('updateReviewListAfterChange', `- Can't find '${reviewedTitle}' to update in full-review-list, so will regenerate whole list.`)
      await makeFullReviewList(configIn, false)
      return
    } else {
      if (simplyDelete) {
        // delete line 'thisLineNum'
        reviewLines.splice(thisLineNum, 1)
        logDebug('updateReviewListAfterChange', `- Deleted line number ${thisLineNum}: '${reviewedTitle}'`)
      } else {
        // update this line in the full-review-list
        reviewLines[thisLineNum] = updatedTSVSummaryLine
        logDebug('updateReviewListAfterChange', `- Updated line number ${thisLineNum}: '${reviewedTitle}'`)
      }
      // re-form the file
      const outputLines = filterAndSortReviewList(reviewLines, configIn)
      const saveRes = DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true)
      if (saveRes) {
        logInfo('updateReviewListAfterChange', `- Saved updated full-review-list OK`)
      } else {
        logWarn('updateReviewListAfterChange', `- problem when updating ${fullReviewListFilename}`)
      }
      // logFullReviewList()

      // Finally, refresh Dashboard
      updateDashboardIfOpen()
    }

  } catch (error) {
    logError('updateReviewListAfterChange', error.message)
  }
}

//-------------------------------------------------------------------------------

/**
 * Work out the next note to review (if any).
 * It assumes the full-review-list is sorted by nextReviewDate (earliest to latest).
 * Note: v2, using the allProjects JSON file (not ordered but detailed)
 * Note: there is now a multi-note variant of this below
 * @author @jgclark
 * @return { ?TNote } next note to review (if any)
 */
export async function getNextNoteToReview(): Promise<?TNote> {
  try {
    // logDebug('getNextNoteToReview', `Starting ...`)
    const config: ReviewConfig = await getReviewSettings()

    // Get contents of allProjects list
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return null
    }

    // Now read from the top until we find a line with a negative or zero value in the first column (nextReviewDays), and not complete
    for (let i = 0; i < allProjectsSorted.length; i++) {
      const thisProject = allProjectsSorted[i]
      const thisNoteFilename = thisProject.filename ?? 'error'
      const nextReviewDays = thisProject.nextReviewDays ?? NaN
      if (nextReviewDays <= 0 && !thisProject.isCompleted && !thisProject.isPaused) { // = before today, or today, and not completed/paused
        logDebug('getNextNoteToReview', `- Next to review -> '${thisNoteFilename}'`)
        const nextNote = DataStore.projectNoteByFilename(thisNoteFilename)
        if (!nextNote) {
          logWarn('getNextNoteToReview', `Couldn't find note '${thisNoteFilename}' -- suggest you should re-run Project Lists to ensure this is up to date`)
          return null
        } else {
          logDebug('getNextNoteToReview', `-> ${displayTitle(nextNote)}`)
          return nextNote
        }
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `No notes ready or overdue for review 🎉`)
    return null
  } catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return null
  }
}

/**
 * Get list of the next note(s) to review (if any).
 * It assumes the full-review-list exists and is sorted by nextReviewDate (earliest to latest).
 * Note: v2, using the allProjects JSON file (not ordered but detailed)
 * Note: This is a variant of the original singular version above, and is used in jgclark.Dashboard/src/dataGeneration.js
 * @author @jgclark
 * @param { number } numToReturn first n notes to return, or 0 indicating no limit.
 * @return { Array<Project> } next Projects to review, up to numToReturn. Can be an empty array. Note: not a TNote but Project object.
 */
export async function getNextProjectsToReview(numToReturn: number = 6): Promise<Array<Project>> {
  try {
    logDebug(pluginJson, `Starting getNextProjectsToReview(${String(numToReturn)})) ...`)
    const config: ReviewConfig = await getReviewSettings()

    // Get contents of allProjects list
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return []
    }

    // Now read from the top until we find a line with a negative or zero value in the first column (nextReviewDays),
    // and not complete (has a tag of 'finished'),
    // and not the same as the previous line (which can legitimately happen).
    // Continue until we have found up to numToReturn such notes.
    const projectsToReview: Array<Project> = []
    let lastFilename = ''
    for (let i = 0; i < allProjectsSorted.length; i++) {
      const thisProject = allProjectsSorted[i]
      const thisNoteFilename = thisProject.filename ?? 'error'
      const nextReviewDays = thisProject.nextReviewDays ?? NaN

      // Get items with review due before today, or today etc.
      if (nextReviewDays <= 0 && !thisProject.isCompleted && !thisProject.isPaused && thisNoteFilename !== lastFilename) {
        const thisNote = DataStore.projectNoteByFilename(thisNoteFilename)
        if (!thisNote) {
          logWarn('getNextNoteToReview', `Couldn't find note '${thisNoteFilename}' -- suggest you should re-run Project Lists to ensure this is up to date`)
          continue
        } else {
          // logDebug('reviews/getNextProjectsToReview', `- Next to review = '${displayTitle(noteToUse)}' with ${nextNotes.length} matches`)
          projectsToReview.push(thisProject)
        }
        if ((numToReturn > 0) && (projectsToReview.length >= numToReturn)) {
          break // stop processing the loop
        }
      }
      lastFilename = thisNoteFilename
    }

    if (projectsToReview.length > 0) {
      logDebug('reviews/getNextProjectsToReview', `- Returning ${projectsToReview.length} project notes ready for review:`)
      projectsToReview.forEach((p) => {
        logDebug('', `${p.title}`)
      })
    } else {
      logDebug('reviews/getNextProjectsToReview', `- No project notes ready for review 🎉`)
    }
    return projectsToReview
  }
  catch (error) {
    logError('reviews/getNextProjectsToReview', JSP(error))
    return []
  }
}

/**
 * Note: v1, using the full-review-list (ordered but not detailed) DEPRECATED.
 * Work out the next note to review (if any).
 * It assumes the full-review-list is sorted by nextReviewDate (earliest to latest).
 * Note: there is now a multi-note variant of this below
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
export async function getNextNoteToReviewV1(): Promise<?TNote> {
  try {
    logDebug('getNextNoteToReview', `Started`)
    const config: ReviewConfig = await getReviewSettings()

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(config, true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    // const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n')

    // FIXME: cope better with valid case of no lines to return
    // Now read from the top until we find a line with a negative or zero value in the first column (nextReviewDays)
    for (let i = 0; i < reviewLines.length; i++) {
      const thisLine = reviewLines[i]
      const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
      const nextNoteTitle = thisLine.split('\t')[2] // get third field = title

      if (nextReviewDays <= 0) { // = before today, or today
        logDebug('getNextNoteToReview', `- Next to review -> '${nextNoteTitle}'`)
        const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
        if (nextNotes.length > 0) {
          return nextNotes[0] // return first matching note
        } else {
          logWarn('getNextNoteToReview', `Couldn't find note with title '${nextNoteTitle}' -- suggest you should re-run Project Lists to ensure this is up to date`)
          return
        }
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `- No notes left ready for review 🎉`)
    return
  } catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return
  }
}

/**
 * Note: v1, using the full-review-list (ordered but not detailed). DEPRECATED.
 * Get list of the next note(s) to review (if any).
 * It assumes the full-review-list exists and is sorted by nextReviewDate (earliest to latest).
 * Note: This is a variant of the original singular version above, and is used in jgclark.Dashboard/src/dataGeneration.js
 * @author @jgclark
 * @param { number } numToReturn first n notes to return, or 0 indicating no limit.
 * @return { Array<TNote> } next notes to review, up to numToReturn. Can be an empty array.
 */
export async function getNextProjectsToReviewV1(numToReturn: number): Promise<Array<TNote>> {
  try {
    logDebug(pluginJson, `Starting getNextProjectsToReview(${String(numToReturn)}))`)
    // $FlowFixMe[incompatible-type] reason for suppression
    const config: ReviewConfig = await getReviewSettings()
    // Get contents of full-review-list
    const reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // If we get here, give a warning, as the file should exist and not be empty
      throw new Error(`full-review-list note empty or missing`)
    } else {
      // const fileLines = reviewListContents.split('\n')

      // Use front-matter library to get past frontmatter
      const fmObj = fm(reviewListContents)
      const reviewLines = fmObj.body.split('\n')

      // Now read from the top until we find a line with a negative or zero value in the first column (nextReviewDays),
      // and not complete (has a tag of 'finished'),
      // and not the same as the previous line (which can legitimately happen).
      // Continue until we have found up to numToReturn such notes.
      // FIXME: cope better with valid case of no lines to return
      const notesToReview: Array<TNote> = []
      let lastTitle = ''
      for (let i = 0; i < reviewLines.length; i++) {
        const thisLine = reviewLines[i]
        const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
        const thisNoteTitle = thisLine.split('\t')[2] // get third field = title
        const tags = thisLine.split('\t')[5] ?? '' // get last field = tags

        // Get items with review due before today, or today etc.
        if (nextReviewDays <= 0 && !tags.includes('finished') && thisNoteTitle !== lastTitle) {
          const nextNotes = DataStore.projectNoteByTitle(thisNoteTitle, true, false) ?? []
          if (nextNotes.length > 0) {
            const noteToUse: TNote = filterOutProjectNotesFromExcludedFolders(nextNotes, config.foldersToIgnore, true)[0]
            logDebug('reviews/getNextProjectsToReview', `- Next to review = '${displayTitle(noteToUse)}' with ${nextNotes.length} matches`)
            notesToReview.push(noteToUse) // add first matching note
            if ((numToReturn > 0) && (notesToReview.length >= numToReturn)) {
              break // stop processing the loop
            }
          } else {
            logWarn('reviews/getNextProjectsToReview', `Couldn't find note with title '${thisNoteTitle}' -- suggest you should re-run Project Lists to ensure this is up to date`)
          }
        }
        lastTitle = thisNoteTitle
      }

      if (notesToReview.length === 0) {
        // If we get here then there are no projects needed for review
        logDebug('reviews/getNextProjectsToReview', `- No notes ready for review 🎉`)
        logDebug('reviews/getNextProjectsToReview', `- No notes ready for review 🎉`)
      }
      return notesToReview
    }
  } catch (error) {
    logError(pluginJson, `reviews/getNextProjectsToReview: ${error.message}`)
    logError(pluginJson, `reviews/getNextProjectsToReview: ${error.message}`)
    return []
  }
}
