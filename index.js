const vscode = require('vscode')

let list

async function readConfig () {
  const config = await vscode.workspace.getConfiguration(
    'continueInlineComment'
  )

  list = config.list
}

/**
 * From <https://github.com/sindresorhus/escape-string-regexp>, but
 * copy/pasted it because it's ESM only and Code doesn't support ESM
 * nor dynamic ESM imports from CJS.
 *
 * FWIW dynamic imports work in the extension debugging mode, but fail
 * once packaged and published.
 */
function escapeStringRegexp (string) {
  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}

async function activate () {
  await readConfig()

  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('continueInlineComment')) {
      await readConfig()
    }
  })

  for (const { comment, languages } of list) {
    for (const language of languages) {
      vscode.languages.setLanguageConfiguration(language, {
        onEnterRules: [
          {
            beforeText: new RegExp(`^\\s*${escapeStringRegexp(comment)} `),
            action: {
              indentAction: vscode.IndentAction.None,
              appendText: `${comment} `
            }
          },
          {
            beforeText: new RegExp(`^\\s*${escapeStringRegexp(comment)}`),
            action: {
              indentAction: vscode.IndentAction.None,
              appendText: comment
            }
          }
        ]
      })
    }
  }
}

module.exports = { activate }
