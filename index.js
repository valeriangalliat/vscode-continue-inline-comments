const vscode = require('vscode')

let list

async function readConfig () {
  const config = await vscode.workspace.getConfiguration(
    'continueInlineComment'
  )

  list = config.list
}

async function activate () {
  await readConfig()

  const escapeStringRegexp = (await import('escape-string-regexp')).default

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
