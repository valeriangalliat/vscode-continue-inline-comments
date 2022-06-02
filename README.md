# 💬 Continue Inline Comments

> [Visual Studio Code extension][marketplace] to automatically continue inline comments.

[marketplace]: https://marketplace.visualstudio.com/items?itemName=val.vscode-continue-inline-comments

## Overview

Visual Studio Code [doesn't support automatic continuation of inline comments](https://github.com/Microsoft/vscode/issues/26694)
out of the box. This extension adds support for it in various languages (see
[default config](#defaults)).

Inspired by [Auto Comment Next Line](https://marketplace.visualstudio.com/items?itemName=ctf0.auto-comment-next-line)
([GitHub](https://github.com/ctf0/vscode-auto-comment-next-line)) which wasn't
working very well for me.

## Configuration

Here's the default config as seen in [`package.json`](package.json). Feel free
to tweak as you please!

```json
{
  "continueInlineComments.list": {
    "type": "array",
    "default": [
      {
        "comment": "//",
        "languages": [
          "php",
          "javascript",
          "typescript",
          "jsonc",
          "scss",
          "sass",
          "json",
          "vue",
          "markdown",
          "javascriptreact",
          "typescriptreact"
        ]
      },
      {
        "comment": "#",
        "languages": [
          "python",
          "ruby",
          "shellscript",
          "makefile"
        ]
      }
    ]
  }
}
```

## How it works

See the full code in [`src/extension.ts`](src/extension.ts).

When a new document is opened or when the language of a document changes
(`vscode.workspace.onDidOpenTextDocument`), we check if the language is
supported by our [config](#defaults). If so, we use
`vscode.languages.setLanguageConfiguration` to extend the `onEnterRules` to add
completion for the inline comments (see [hacks](#hacks) below).

On load, we also iterate over `vscode.window.visibleTextEditors` to apply the
`onEnterRules` because otherwise the editors _already opened_ when the extension
is loaded would not trigger `onDidOpenTextDocument`.

## Hacks

* Extending `onEnterRules` is pretty hacky to do. Because
  `vscode.languages.setLanguageConfiguration` *overwrites* the properties we
  give to it, it means that by setting our custom `onEnterRules` entry, we're
  effectively removing all the other `onEnterRules` defined by the original
  language definition. Not good.

  To avoid that, we need to get the existing language configuration to add our
  custom rule *on top* of the existing ones.

  The problem is that there's no way to *get* the existing language
  configuration from the extensions API
  ([see](https://github.com/microsoft/vscode/issues/109919) and
  [see](https://github.com/microsoft/vscode/issues/2871)), so we have to resort
  to a dirty hack where we manually *identify the language configuration files*
  of the installed extensions*, *load that file manually* with [jsonc-parser](https://www.npmjs.com/package/jsonc-parser),
  and *translate the JSON representation of `onEnterRules`* (which
  is different from the JavaScript representation expected by the extensions
  API) so that we can use it in `vscode.languages.setLanguageConfiguration`.

  And while it's annoying AF and a pretty dirty hack in my opinion, it does work
  pretty fucking well.

* [jsonc-parser](https://www.npmjs.com/package/jsonc-parser) is not bundled
  with esbuild because of [this issue](https://github.com/microsoft/node-jsonc-parser/issues/57).

* In `package.json`, the `repository` needs to be set to
  `github:valeriangalliat/vscode-continue-inline-comments` instead of
  just `valeriangalliat/vscode-continue-inline-comments` (which are
  semantically equivalent) because `vsce` doesn't support the latter
  syntax.

* The `UNLICENSE` file needs to be symlinked as `LICENSE` for `vsce` to
  be happy.

## Development

```sh
npm install
npm run watch
```

## Publishing

See [publishing extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

```sh
npm install -g vsce
vsce package
vsce publish
```
