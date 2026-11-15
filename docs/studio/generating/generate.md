# Generating code

Paste or open JSON, JSON Schema, TypeScript or GraphQL and get typed models with serializers in 27 target languages. Generation runs in a background worker, so typing stays smooth; results update about a third of a second after you stop typing.

## How to use it

Choose the source kind with the segmented control, set the top-level type name, pick a language chip or open More languages. Inference switches (enums, maps, dates and times, all-optional) apply to every language.

## When something goes wrong

Malformed input shows the parser's message under the source and in the output pane; nothing is overwritten until a generation succeeds. TypeScript input needs the desktop app or the self-hosted server because it runs the TypeScript compiler.

## Privacy and security

All work happens on your device or your own server. Nothing is uploaded.

## How to check it works

Generate from each built-in sample and compare against the command-line quicktype output for the same input.

## Suggested articles

- [Language options](../generating/language-options.md)
- [Samples](../generating/samples.md)
- [Local history and exports](../records/history.md)
