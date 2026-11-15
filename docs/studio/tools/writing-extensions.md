# Writing an extension

An extension is a folder inside the extensions folder.

```json
{
  "manifestVersion": 1,
  "id": "my-extension",
  "name": "My extension",
  "version": "1.0.0",
  "description": "What it does",
  "command": ["node", "index.js"],
  "permissions": ["read-generated-code"],
  "commands": [{ "id": "run", "title": "Run it" }],
  "limits": { "timeoutMs": 5000, "maxOutputBytes": 65536 }
}
```

The program receives one line on standard input: `{"protocol":1,"command":"run","input":"...code..."}` and answers with one line: `{"ok":true,"output":"..."}` or `{"ok":false,"error":"..."}`.

## How to use it

Use `node` as the first command word to run with the app's bundled runtime; any other program on your PATH works too.

## When something goes wrong

Answers that are not JSON, runs over the time limit and output over the size limit are reported as failures.

## Privacy and security

Do not ask for permissions you do not need. Extensions never receive the user's personal wording file.

## How to check it works

Copy the Code stats example and change it.

## Suggested articles

- [Extensions](../tools/extensions.md)
