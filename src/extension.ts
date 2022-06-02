import path from 'node:path'
import fs from 'node:fs/promises'
import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import escapeStringRegexp from 'escape-string-regexp'

const CONFIG_NAME = 'continueInlineComments'

interface Comment {
  comment: string
  languages: string[]
}

interface ConfigIndex {
  [language: string]: {
    comment: string
  }
}

function indexConfig (list: Comment[]): ConfigIndex {
  const index: ConfigIndex = {}

  for (const { comment, languages } of list) {
    for (const language of languages) {
      index[language] = { comment }
    }
  }

  return index
}

let globalConfig: ConfigIndex | undefined

function getConfig (): ConfigIndex {
  if (globalConfig == null) {
    globalConfig = indexConfig(vscode.workspace.getConfiguration(CONFIG_NAME).get('list') ?? [])
  }

  return globalConfig
}

interface LanguagesIndex {
  [language: string]: {
    configPath: string
  }
}

let globalLanguages: LanguagesIndex | undefined

function getLanguagesIndex (): LanguagesIndex {
  if (globalLanguages == null) {
    globalLanguages = {}

    for (const ext of vscode.extensions.all) {
      for (const language of ext?.packageJSON?.contributes?.languages ?? []) {
        if (language.configuration != null) {
          globalLanguages[language.id] = {
            configPath: path.resolve(ext.extensionPath, language.configuration)
          }
        }
      }
    }
  }

  return globalLanguages
}

function isLanguageSupported (languageId: string): boolean {
  return languageId in getConfig()
}

interface IRegExp {
  pattern: string
  flags?: string
}

interface IEnterAction {
  indent: 'none' | 'indent' | 'indentOutdent' | 'outdent'
  appendText?: string
  removeText?: number
}

/**
 * Borrowed form <https://github.com/microsoft/vscode/blob/f29671557b54147d5eec5de77ab10876c795b8ba/src/vs/workbench/contrib/codeEditor/browser/languageConfigurationExtensionPoint.ts#L41>
 * as sadly those types are not importable.
 */
interface IOnEnterRule {
  beforeText: string | IRegExp
  afterText?: string | IRegExp
  previousLineText?: string | IRegExp
  action: IEnterAction
}

/**
 * This code is taken form <https://github.com/microsoft/vscode/blob/f29671557b54147d5eec5de77ab10876c795b8ba/src/vs/workbench/contrib/codeEditor/browser/languageConfigurationExtensionPoint.ts#L421>.
 */
function parsePattern (pattern: string | IRegExp): RegExp {
  if (typeof pattern === 'string') {
    return new RegExp(pattern)
  }

  return new RegExp(pattern.pattern, pattern.flags)
}

/**
 * Because Visual Studio Code currently doesn't allow to get the active language
 * configuration, we read the JSON that defines it and need to parse it again
 * manually.
 *
 * See <https://github.com/microsoft/vscode/issues/109919> and
 * <https://github.com/microsoft/vscode/issues/2871>.
 *
 * Code inspired by <https://github.com/microsoft/vscode/blob/f29671557b54147d5eec5de77ab10876c795b8ba/src/vs/workbench/contrib/codeEditor/browser/languageConfigurationExtensionPoint.ts#L311>.
 */
function parseEnterRules (rules: IOnEnterRule[]): vscode.OnEnterRule[] {
  return rules.map(rule => {
    const newRule = rule as unknown as vscode.OnEnterRule

    if (rule.beforeText != null) {
      newRule.beforeText = parsePattern(rule.beforeText)
    }

    if (rule.afterText != null) {
      newRule.afterText = parsePattern(rule.afterText)
    }

    if (rule.previousLineText != null) {
      newRule.previousLineText = parsePattern(rule.previousLineText)
    }

    if (rule.action?.indent != null) {
      const action = rule.action.indent[0].toUpperCase() + rule.action.indent.slice(1) as keyof typeof vscode.IndentAction
      newRule.action.indentAction = vscode.IndentAction[action]
    }

    return newRule
  })
}

const extendedCache: { [language: string]: boolean } = {}

async function extendLanguageConfiguration (languageId: string): Promise<void> {
  if (languageId in extendedCache) {
    return
  }

  const config = getConfig()
  const { comment } = config[languageId]
  const index = getLanguagesIndex()
  const { configPath } = index[languageId]
  const languageConfig = jsonc.parse(await fs.readFile(configPath, 'utf8'))
  const onEnterRules = parseEnterRules(languageConfig.onEnterRules ?? [])

  vscode.languages.setLanguageConfiguration(languageId, {
    onEnterRules: [
      ...onEnterRules,
      {
        beforeText: new RegExp(`^\\s*${escapeStringRegexp(comment)}`),
        action: {
          indentAction: vscode.IndentAction.None,
          appendText: `${comment} `
        }
      }
    ]
  })

  extendedCache[languageId] = true
}

export async function activate (): Promise<void> {
  // Warm up cache
  getConfig()

  // Refresh cache when config changes
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(CONFIG_NAME)) {
      globalConfig = undefined
      getConfig()
    }
  })

  vscode.workspace.onDidOpenTextDocument(async (e) => {
    if (isLanguageSupported(e.languageId)) {
      await extendLanguageConfiguration(e.languageId)
    }
  })

  // `onDidOpenTextDocument` doesn't fire on load for the already opened
  // tabs, so we need to go through them and load the associated languages.
  for (const editor of vscode.window.visibleTextEditors) {
    await extendLanguageConfiguration(editor.document.languageId)
  }
}
