// @flow
//-----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 10.5.2022 for v0.12.0, @jgclark
//-----------------------------------------------------------------------------

import { log, logError, logWarn } from '../../helpers/dev'
import {
  allNotesSortedByChanged,
  printNote,
} from '../../helpers/note'
import { getParaFromContent, } from '../../helpers/paragraph'
import {
  chooseFolder,
  chooseHeading
} from '../../helpers/userInput'

//-----------------------------------------------------------------
/**
 * Command from Eduard to move a note to a different folder
 * @author @eduardme
 */
export async function moveNote(): Promise<void> {
  const { title, filename } = Editor
  if (title == null || filename == null) {
    // No note open, so don't do anything.
    logError('moveNote','No note open. Stopping.')
    return
  }
  const selectedFolder = await chooseFolder(`Select a folder for '${  title  }'`, true) // include @Archive as an option
  log('moveNote', `move ${title} (filename = ${filename}) to ${selectedFolder}`)

  const newFilename = DataStore.moveNote(filename, selectedFolder)

  if (newFilename != null) {
    await Editor.openNoteByFilename(newFilename)
  } else {
    logError('moveNote',`Error trying to move note`)
  }
}

/** 
 * Open a user-selected note in a new window.
 * @author @jgclark
 */
export async function openNoteNewWindow(): Promise<void> {
  // Ask for the note we want to open
  const notes = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to open in new window',
  )
  const note = notes[re.index]
  const filename = note.filename
  await Editor.openNoteByFilename(filename, true)
}

/** 
 * Open a user-selected note in a new split of the main window.
 * Note: uses API option only available on macOS and from v3.4. 
 * It falls back to opening in a new window on unsupported versions.
 * @author @jgclark
 */
export async function openNoteNewSplit(): Promise<void> {
  // Ask for the note we want to open
  const notes = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to open in new split window',
  )
  const note = notes[re.index]
  const filename = note.filename
  await Editor.openNoteByFilename(filename, false, 0, 0, true)
}

/**
 * Jumps the cursor to the heading of the current note that the user selects
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export async function jumpToHeading(): Promise<void> {
  const { paragraphs, note } = Editor
  if (note == null || paragraphs == null) {
    // No note open, or no content
    return
  }

  const headingStr = await chooseHeading(note, false, false, false)
  // find out position of this heading, ready to set insertion point
  // (or 0 if it can't be found)
  const startPos = getParaFromContent(note, headingStr)?.contentRange?.start ?? 0
  console.log(startPos)
  Editor.select(startPos, 0)
}

/** 
 * Jumps the cursor to the heading of the current note that the user selects
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export async function jumpToNoteHeading(): Promise<void> {
  // first jump to the note of interest, then to the heading
  const notesList = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notesList.map((n) => n.title ?? 'untitled'),
    'Select note to jump to',
  )
  const note = notesList[re.index]

  // Open the note in the Editor
  if (note != null && note.title != null) {
    await Editor.openNoteByTitle(note.title)
  } else {
    console.log("\terror: couldn't open selected note")
    return
  }

  // Now jump to the heading
  await jumpToHeading()
}

/**
 * Jump cursor to the '## Done' heading in the current file
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export function jumpToDone(): void {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }

  // Find the 'Done' heading of interest from all the paragraphs
  const matches = paras
    .filter((p) => p.headingLevel === 2)
    .filter((q) => q.content.startsWith('Done')) // startsWith copes with Done section being folded

  if (matches != null) {
    const startPos = matches[0].contentRange?.start ?? 0
    log('jumpToDone', `Jumping to '## Done' at position ${startPos}`)
    // Editor.renderedSelect(startPos, 0) // sometimes doesn't work
    Editor.select(startPos, 0)

    // Earlier version
    // Editor.highlight(p)
  } else {
    logWarn('jumpToDone', "Couldn't find a '## Done' section. Stopping.")
  }
}
