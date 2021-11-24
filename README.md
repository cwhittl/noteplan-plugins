# NotePlan Plugins

## Overview
NotePlan Plugins provides an extensive API for extending default editing and task management and work across all platforms (macOS and iOS).

Each plugin command can be invoked using the [NotePlan Command Bar](https://help.noteplan.co/article/65-commandbar-plugins), or by entering any of available commands directly in the editor by entering `/command` (NotePlan will auto update the list of possible commands as you type)
![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/6081f7f4c9133261f23f4b41/images/608c5886f8c0ef2d98df845c/file-fLVrMGjoZr.png)

## Prerequisite
The following items are required for NotePlan Plugin Development

- Node 12.15 or greater
- NotePlan 3.0.21 or greater
- macOS Catalina 10.15.2 or greater (strongly recommend macOS Big Sur 11.x)
- github `gh` is strongly recommended

## Plugin Information
If you have an idea for a plugin, [submit them here](https://feedback.noteplan.co/plugins-scripting) or inquire in the [NotePlan Discord community](https://discord.gg/D4268MT)'s `#plugin-ideas` channel.

If you are a developer and want to contribute and build your plugins, see the [plugin writing documentation](https://help.noteplan.co/article/67-create-command-bar-plugins) and discuss this with other developers on [Discord](https://discord.gg/D4268MT) `#plugin-dev` channel.  You might want to consult this [good modern JavaScript tutorial](https://javascript.info/).

### Getting Started with Plugin Development

**Step 1: Clone NotePlan Plugin Repository**

[Clone this repository](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository-from-github/cloning-a-repository)

**Step 2: Install Node (if not installed)**

Make sure you have a recent version of `node` and `npm` installed (if you need to install node, `brew install node` is the quickest method, you can follow instructions on [node website](https://nodejs.org/en/download/)).

**Step 3: Initialize Local Development Environment**

Run the following commands from the root of your local GitHub repository for `NotePlan/plugins`. 

`
npm install && npm run init
`

This will install the necessary npm dependencies and initialize your plugin working directory, including:

 - Configure `eslint` [eslint](https://eslint.org/) (for checking code conventions)
 - Configure `flow` [flow](https://flow.org/) (for type checking)
 - Configure `babel` [babel](https://babeljs.io/) (a JS compiler)
 - Configure `rollup` [rollup](https://rollupjs.org/guide/en/) (for bundling multiple source files into a single release).

Each of these tools have their own configuration files at the root directory (e.g., `.flowconfig` or `.eslintrc`)

*Note: Each of these configuration files can be overridden if needed by placing a project specific configuration file in you project plugin, however, for consistency with other NotePlan plugins, we encourage to use the defaults wherever possible.*

### Creating your first NotePlan Plugin
Using the NotePlan CLI, perform the following actions:

**Step 1: Review List of Available Plugins**

`noteplan-cli plugin:info` to see a list of all available commands across all existing NotePlan plugins.

**Step 2: Check if your desired plugin command is available**

You will need to make sure there are no duplicate plugin command names, otherwise NotePlan will activate the first matched command name
`noteplan-cli plugin:info --check <name>` to see if your plugin command is available

**Step 3: Create your plugin using NotePlan CLI**
Answer the prompt questions (or supply all the necessary options from command line (see `noteplan-cli plugin:create --help` for details)

`noteplan-cli plugin:create`

**Step 4: Startup Auto Watch Process**

`npm run autowatch <your_plugin_folder>` from the root directory to build your plugin as you develop so it can be tested in NotePlan.

**Step 5: Start your plugin command develop and test locally**

You can now develop and test your plugin locally,

**Step 6: Create Pull Request (if you wish to make your plugin public)**

At this point, if you would like to make your plugin available publicly, you can proceed to [creating Pull Request](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) to the NotePlan Plugin Repository (see information below)



### Common Development Actions
These are the most common commands you will use while developing:

#### File Watcher
The default watch command `npm run autowatch` (without any other arguments) command will rebuild _all_ plugins just in case shared files affect another plugin. If you want to focus autowatch on a subset of plugins, you can pass the plugin folder name to autowatch like so:

**npm run autowatch**

`npm run autowatch` from the root of your local `NotePlan/plugins` repository which will bundle all the files in your `/src` directory into single file `scripts.js` and will be copied from your repository directory to your Plugins folder in the running NotePlan data directory for testing.

*Note: The watcher will remain running, _watching_ the NotePlan directory and re-compile whenever changes have been made to your `<your_plugin>/src` JavaScript files.*

**npm run autowatch <your_plugin_directory>**

For example, running `npm run autowatch dwertheimer.TaskAutomations` will perform the same watching operations for the `dwertheimer.TaskAutomations` plugin only.

#### Create Pull Request

Once you are finished editing and testing your plugin, you can [submit a Pull Request](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) to the NotePlan/plugins repository and it will be reviewed for inclusion. Once it has been approved, it will be available from **NotePlan > Preferences > Plugins** section, enabling it to be installed by other NotePlan users

#### Using NotePlan Debugger
If you need to use your IDE JavaScript Debugger This works great, but if you want to try to debug in the [Javascript debugger](https://help.noteplan.co/article/103-debugging-plugins) you can use the following watching syntax:

`npm run autowatch dwertheimer.TaskAutomations -- -debug`

This process will bundle your code into single `script.js` file, but will skip the ES transpiling process. When you have completed debugging process, make sure the code has been transpiled (using `npm run autowatch...` process outlined above)

### Frequently Used Commands
The common script you will run `npm run autowatch` however, you may need to use any of the following

- `npm run autowatch:compact` a less verbose version of `autowatch` that might suit more experienced developers
- `noteplan-cli plugin:info --check <name>` to check if you desired command name is in use by any other NotPlan Plugins
<!-- - `npm run build`: Will build all the plugins into single files (where needed) -->
- `npm run typecheck`: typecheck all javascript files with `Flow`. Only files with a `// @flow` comment are checked.
- `npm run fix`: lint and auto-format
- `npm run docs`:  build documentation for javascript files
- `npm run lint`: run ESlint on the entire repo
- `npm run lint-fix`: run ESlint on the entire repo and fix whatever it can automatically fix
- `npm run format`: auto-format all Javascript files using `prettier`
- `gh release delete <release name>`: Will delete the release from the repository, so making it unavailable in NotePlan as well. (Though it won't remove it from anyone who has already downloaded it.)

## Editor Setup

Use the setup guide for your preferred editor (we prefer Visual Studio Code), and then read the section on Working with Multiple Files.

### Visual Studio Code (recommended)

**Install VSCode Extensions**

1. Install the following extensions for the following tools:
      - `flow` "Flow Language Support" by flowtype
      - `eslint` "ESLint" by Dirk Baeumer
      - `prettier` "Prettier - Code formatter" by Prettier

**Update Settings**

1. Set `prettier` to be the default formatter for js files.
   - You can open the Command Bar using `CMD+SHIFT+P` and then search for `Format Document`.
   - When you do this, you may get asked for a formatter of choice. Choose "Prettier"
   - If it asks you if this should be your default for all JS files, choose Yes.
2. Restart the editor to ensure the plugins are working.
   - You should see type errors when you make those
   - You should see lint errors when you format code wrong
   - You should see your code get auto formatted when you save
3. Make sure to open this folder directly in VSCode and not the entire repo as the ESLint plugin can be annoying about that

### Sublime Text 3 and 4

1. Install the following extensions using Package Control
   - `SublimeLinter` This allows various linters to work
   - `SublimeLinter-eslint`
   - `SublimeLinter-flow`
   - `jsPrettier`
   - `Babel` Syntax definitions for ES6 Javascript and React JSX extensions
2. Configure your packages:
   - Open a `.js` file
   - From the View menu, select Syntax → Open all with current extension as… → Babel → JavaScript (Babel)
   - Open the package settings for `jsPrettier` and add `"auto_format_on_save": true,`

### Linting Code
If you don't have an editor set up to lint as you code, you can run `npm run test` and it will give a list of problems to fix.

### Using Flow
By practice, NotePlan plugins use [flow](https://flow.org/) for static type checking. You can get more information by referencing [NotePlan Flow Guide](https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md)

## Using NotePlan CLI
NotePlan CLI can be used throughout your development process.  For more information about available NotePlan CLI commands, you can use:

```bash
noteplan-cli <command>
or
np-cli <command>
```

The following commands are available:

### plugin:info
Provides information about the installed NotePlan Plugins (see `noteplan-cli plugin:info --help` for available options)

### plugin:create
Used to create new NotePlan Plugins (see `noteplan-cli plugin:create --help` for available options)

## NotePlan Plugin Support
Should you need support for anything related to NotePlan Plugins, you can reach us at the following:

### Email
If you would prefer email, you can reach us at:

- [NotePlan Info](hello@noteplan.co)

### Discord
Perhaps the fastest method would be at our Discord channel, where you will have access to the widest amount of resources:

- [Discord Plugins Channel](https://discord.com/channels/763107030223290449/784376250771832843)

### Github Issues
This is a great resource to request assistance, either in the form of a bug report, or feature request for a current or future NotePlan Plugin

- [GitHub Issues](https://github.com/NotePlan/plugins/issues/new/choose)

## Contributing

If you would like to contribute to the NotePlan Plugin repository, feel free to submit a [Pull Request] (https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) for any existing NotePlan Plugin, or any of the support materials.
