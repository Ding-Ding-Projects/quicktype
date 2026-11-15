# Extensions

The desktop app runs extensions: folders with a studio-extension.json manifest and a program that reads one JSON line and writes one JSON line, in any language. Two built-in extensions ship: Code stats and Header stamp.

## How to use it

Extensions tab: enable an extension (you are asked to allow its declared permissions), run its commands on the generated code, open the extensions folder to add your own. A manifest whose permissions change needs consent again.

## When something goes wrong

Each run has a time limit and an output size limit; a slow or noisy extension is stopped and reported. An invalid manifest is skipped.

## Privacy and security

Extensions run in their own process with a minimal environment: no tokens or secrets are passed, and they only receive the generated code if they declare read-generated-code.

## How to check it works

Enable Code stats, run it, then edit its manifest permissions and check consent is asked again.

## Suggested articles

- [Writing an extension](../tools/writing-extensions.md)
