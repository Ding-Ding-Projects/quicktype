# Personal wording file format

Version 1 is a JSON object with exactly two fields: schemaVersion (always 1) and entries, a map from ordinary wording to your replacement.

```json
{
  "schemaVersion": 1,
  "entries": {
    "ordinary wording": "your replacement"
  }
}
```

## How to use it

Longer keys win over shorter ones, and replacements only happen at word edges. Code, file names and your own data are never changed.

## When something goes wrong

See Personal wording files for every refusal reason.

## Privacy and security

The format carries no executable content and is parsed by a strict parser that rejects duplicate keys.

## How to check it works

Validate files with the same limits the app enforces before sharing them with others.

## Suggested articles

- [Personal wording files](../wording/personal-wording.md)
