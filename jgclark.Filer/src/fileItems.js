// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected selectedParagraphs to other notes
// Jonathan Clark
// last updated 1.2.2022 for v0.6.0
// ----------------------------------------------------------------------------

import {
  castBooleanFromMixed,
  castStringFromMixed,
} from '../../helpers/dataManipulation'
import {
  getDateFromString,
  hyphenatedDate,
  isoDateStringFromCalendarFilename,
  toLocaleDateString,
 } from '../../helpers/dateTime'
import { clo } from '../../helpers/dev'
import {
  rangeToString,
  displayTitle
} from '../../helpers/general'
import { allNotesSortedByChanged } from '../../helpers/note'
import {
  calcSmartPrependPoint,
  findEndOfActivePartOfNote,
  parasToText,
  selectedLinesIndex,
  RE_HORIZONTAL_LINE,
} from '../../helpers/paragraph'
import { todaysDateISOString } from '../../helpers/dateTime'
import { chooseHeading } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'


//-----------------------------------------------------------------------------
// // Get settings
// const DEFAULT_FILER_OPTIONS = `  filer: {
//     addDateBacklink: true, // whether to insert date link in place of the moved text
//     useExtendedBlockDefinition: false
//   },
// `

type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  useExtendedBlockDefinition: boolean,
  whereToAddInSection: string
}

async function getFilerSettings(): Promise<FilerConfig> {
  console.log(`Start of getFilerSettings()`)

  const v2Config: EventsConfig = DataStore.settings
  // $FlowFixMe[incompatible-call]
  // clo(v2Config, 'v2Config')

  if (v2Config != null && Object.keys(v2Config).length > 0) {
    const config: FilerConfig = v2Config
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V2:`)
    return config
  } else {
  // Get config settings from Template folder _configuration note or ConfigV2
    const v1config = await getOrMakeConfigurationSection(
      'filer',
      // DEFAULT_FILER_OPTIONS,
      // no minimum config
    ) ?? {}

    let config: FilerConfig
    // ???
    if (v1config == null || Object.keys(v1config).length === 0) {
    console.log(`\tInfo: couldn't find 'filer' settings. Will use defaults.`)
    config = {
      addDateBacklink: false,
      dateRefStyle: "link",
      useExtendedBlockDefinition: false,
      whereToAddInSection: "start",
    }
  } else {
    console.log(`\tFound 'filer' settings`)
    config = {
      addDateBacklink: castBooleanFromMixed(v1config, 'addDateBacklink'),
      dateRefStyle: castStringFromMixed(v1config, 'dateRefStyle'),
      useExtendedBlockDefinition: castBooleanFromMixed(v1config, 'useExtendedBlockDefinition'),
      whereToAddInSection: castStringFromMixed(v1config, 'whereToAddInSection'),
    }
  }
  return config
}

// ----------------------------------------------------------------------------

/**
 * Move text to a different note.
 * NB: Can't selecet dates with no existing Calendar note.
 * TODO(EduardMe): Waiting for better date picker from Eduard before working further on this.
 * 
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current heading + its following section
 * - current line
 * - current line (plus any paragraphs directly following). NB: the Setting
 *   'useExtendedBlockDefinition' decides whether these directly following paragaphs
 *   have to be indented (false) or can take all following lines at same level until next
 *   empty line as well.
 * @author @jgclark
 */
export async function moveParas(): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    console.log('warning: No note open, so stopping.')
    return
  }

  // Get config settings from Template folder _configuration note
  const config = await getFilerSettings()
  // await getOrMakeConfigurationSection(
  //   'filer',
  //   DEFAULT_FILER_OPTIONS,
  //   // no minimum config
  // )
  // // for once it doesn't matter if filerConfig returns null (though it shouldn't)
  // // $FlowIgnore[incompatible-use]
  // const pref_addDateBacklink = !!filerConfig.addDateBacklink ?? true // !! ensures first item is boolean
  // // console.log(pref_addDateBacklink.toString())
  // // $FlowIgnore[incompatible-use]
  // const pref_dateRefStyle = filerConfig.dateRefStyle ?? 'link'
  // // console.log(pref_dateRefStyle)
  // // $FlowIgnore[incompatible-use]
  // const pref_useExtendedBlockDefinition = !!filerConfig.useExtendedBlockDefinition ?? false // !! ensures first item is boolean
  // // console.log(pref_useExtendedBlockDefinition.toString())
  // // $FlowIgnore[incompatible-use]
  // const pref_whereToAddInSection = filerConfig.whereToAddInSection ?? 'start'
  // // console.log(pref_whereToAddInSection)

  // Get current selection, and its range
  // TODO: Break this out into a separate helper function, which could also be used in progress.js
  // TODO: First check progress.js for getSelectedParaIndex() which does some of this.
  const selection = Editor.selection
  if (selection == null) {
    console.log('warning: No selection found, so stopping.')
    return
  }
  // $FlowFixMe[incompatible-call]
  const firstSelParaIndex = selectedLinesIndex(Editor.selection, paragraphs)
  let parasInBlock: Array<TParagraph> =
    getParagraphBlock(note, firstSelParaIndex, config.useExtendedBlockDefinition)

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first selectedPara in parasInBlock
  if (config.addDateBacklink && note.type === 'Calendar') {
    parasInBlock[0].content = `${parasInBlock[0].content} >${todaysDateISOString}`
  }

  // There's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]
  // TODO(EduardMe): The problem is that the showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
  console.log(displayTitle(destNote)) // NB: -> first item in list (if a new item is typed)

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true)).toString() // don't know why this coercion is required for flow

  console.log(`  Moving to note: ${destNote.title ?? 'untitled'} under heading: '${headingToFind}'`)

  // Add to new location
  // Currently there's no API function to deal with multiple selectedParagraphs,
  // but we can insert a raw text string.
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than in supports)
  const destNoteParas = destNote.paragraphs
  let insertionIndex = null
  if (headingToFind === destNote.title || headingToFind.includes('(top of note)')) { // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destNote)
    console.log(`  -> top of note, line ${insertionIndex}`)
  } else if (headingToFind.includes('(bottom of note)')) {
    insertionIndex = destNoteParas.length + 1
    console.log(`  -> bottom of note, line ${insertionIndex}`)
  } else {
    for (let i = 0; i < destNoteParas.length; i++) {
      const p = destNoteParas[i]
      if (p.content.trim() === headingToFind && p.type === 'title') {
        insertionIndex = i + 1
        break
      }
    }
    console.log(`  -> other heading, line ${String(insertionIndex)}`)
  }
  if (insertionIndex === null) {
    console.log(`  Error: insertionIndex is null. Stopping.`)
    return
  }
  // console.log(`  Inserting at index ${insertionIndex}`)
  await destNote.insertParagraph(selectedParasAsText, insertionIndex, 'empty')

  // delete from existing location
  // console.log(`  About to remove ${parasInBlock.length} selectedParas (parasInBlock)`)
  note.removeParagraphs(parasInBlock)
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any indented paragraphs that directly follow it
 * - current line, plus if this line is a heading, its following section
 * 
 * The plugin setting 'useExtendedBlockDefinition' decides whether to include more lines:
 * if its true (and by default it is false) then it will work as if the cursor is on the
 * preceding heading line, and take all its lines up until the next same-level heading.
 *
 * NB: in both cases the block always finishes before any horizontal line (e.g. --- or ***).
 * @author @jgclark
 * @param {[TParagraph]} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} useExtendedBlockDefinition - ???
 * @return {[TParagraph]} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  note: TNote,
  selectedParaIndex: number,
  useExtendedBlockDefinition: boolean
): Array<TParagraph> {
  const endOfActiveSection = findEndOfActivePartOfNote(note)
  const allParas = note.paragraphs
  const selectedPara = allParas[selectedParaIndex]
  const parasInBlock: Array<TParagraph> = []
  console.log(
    `  Para '${selectedPara.content}' type: ${selectedPara.type}, index: ${selectedParaIndex}`,
  )
  // if this is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    console.log(`  Found heading level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    for (let i = selectedParaIndex + 1; i < allParas.length; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        break
      } // stop as new heading of same or higher level
      parasInBlock.push(p)
    }
    console.log(`  Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading.
    const startingIndentLevel = selectedPara.indents
    console.log(`  Found single line with indent level ${startingIndentLevel}`)
    parasInBlock.push(selectedPara)

    if (useExtendedBlockDefinition) {
      let thisHeadingLevel = 6 // i.e. higher than normal bounds to allow for case where there is no heading at the start of the block
      // include line unless we hit a new heading, an empty line, or a less-indented line
      // TODO: also work out what to do about lower-level headings
      // First look earlier to find earlier lines up to a blank line or horizontal rule
      for (let i = selectedParaIndex - 1; i >= 0; i--) {
        const p = allParas[i]
        // console.log(`  ${i} / indent ${p.indents} / ${p.content}`)
        if (p.content.match(RE_HORIZONTAL_LINE)) {
          // console.log(`Found HR`)
          break
        } else if (p.content === '') {
          // console.log(`Found blank line`)
          break
        } else if (p.type === 'title') {
          // console.log(`Found title`)
          thisHeadingLevel = p.headingLevel
          parasInBlock.unshift(p) // save para onto front, but then stop
          break
        }
        parasInBlock.unshift(p) // save para onto front
      }
      console.log(`For extended block found ${parasInBlock.length - 1} lines to include before`)

      // Now add all lines up until the next same-level heading or HR or blank
      for (let i = selectedParaIndex + 1; i < endOfActiveSection; i++) {
        const p = allParas[i]
        // console.log(`  ${i} / indent ${p.indents} / ${p.content}`)
        // stop if horizontal line
        if (p.content.match(RE_HORIZONTAL_LINE)) {
          // console.log(`Found HR`)
          break
        } else if (p.content === '') {
          // console.log(`Found blank line`)
          break
        }
        if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
          // console.log(`Found Heading level ${p.headingLevel}`)
          break
        }
        parasInBlock.push(p) // add onto end of array
      }
    } else {
      // Not extended definition.
      // See if there are following indented lines to move as well
      for (let i = selectedParaIndex + 1; i < endOfActiveSection; i++) {
        const p = allParas[i]
        // console.log(`  ${i} / indent ${p.indents} / ${p.content}`)
        // stop if horizontal line
        if (p.content.match(RE_HORIZONTAL_LINE)) {
          // console.log(`Found HR`)
          break
        } else if (p.content === '') {
          // console.log(`Found blank line`)
          break
        } else if (p.indents <= startingIndentLevel) {
          // stop as this selectedPara is same or less indented than the starting line
          // console.log(`Stopping as found lower indent (and not extended definition)`)
          break
        }
        parasInBlock.push(p) // add onto end of array
      }
    }
    console.log(`  Found ${parasInBlock.length - 1} paras:`)
    for (let pib of parasInBlock) {
      console.log(`  -> ${pib.content}`)
    }
  }
  return parasInBlock
}