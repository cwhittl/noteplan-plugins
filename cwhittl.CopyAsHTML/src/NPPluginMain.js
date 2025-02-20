// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev cwhittl.CopyAsHTML --test --watch --coverage`
// IMPORTANT: It's a good idea for you to open the settings ASAP in NotePlan Preferences > Plugins and set your plugin's logging level to DEBUG

/**
 * LOGGING
 * A user will be able to set their logging level in the plugin's settings (if you used the plugin:create command)
 * As a general rule, you should use logDebug (see below) for messages while you're developing. As developer,
 * you will set your log level in your plugin preferences to DEBUG and you will see these messages but
 * an ordinary user will not. When you want to output a message,you can use the following.
 * logging level commands for different levels of messages:
 *
 * logDebug(pluginJson,"Only developers or people helping debug will see these messages")
 * log(pluginJson,"Ordinary users will see these informational messages")
 * logWarn(pluginJson,"All users will see these warning/non-fatal messages")
 * logError(pluginJson,"All users will see these fatal/error messages")
 */
import pluginJson from '../plugin.json'
import {
  getNoteContentAsHTML,
} from '@helpers/HTMLView'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

// NOTE: Plugin entrypoints (jsFunctions called by NotePlan) must be exported as async functions or you will get a TypeError in the NotePlan plugin console
// if you do not have an "await" statement inside your function, you can put an eslint-disable line like below so you don't get an error
// eslint-disable-next-line require-await
export async function noteAsHTML(): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    const { note, content } = Editor

    const body = await getNoteContentAsHTML(content, note)
    //Clipboard.setStringForType(body, 'public.html')  
    Clipboard.setDataForType(body, 'public.html')  
    //Clipboard.string = body
    //logWarn(Clipboard.types)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function contentAsHTML(): Promise<void> {
  try {
    const { note } = Editor
    const selectedLinesText = Editor.selectedLinesText.join('\n') || ''
    const body = await getNoteContentAsHTML(selectedLinesText, note)
    //console.log("types: " + Clipboard.types)
    //Clipboard.setStringForType(body, 'public.html')  
    //Clipboard.setDataForType(body, 'public.html')  
    //console.log("result:" + await Clipboard.string)
    Clipboard.string = body
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
