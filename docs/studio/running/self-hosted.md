# Self-hosted container

Run the web edition on a machine on your network and open it from any browser, phone included.

## How to use it

With Docker: `docker compose -f studio/compose.yaml up -d`, or on Windows `studio\host.bat start`, which waits for the health check and prints the network addresses to open. Other modes: stop, restart, status, logs, update.

## When something goes wrong

If the health check does not answer within 30 seconds, host.bat says so and suggests `host.bat logs`. Features that need the desktop app (dropping a wording file, extensions, saving into folders) show a banner pointing to the download.

## Privacy and security

The container runs as an unprivileged user with a read-only file system and no added capabilities. It makes no outbound requests.

## How to check it works

Start it, open the printed address from another device, and generate from the TypeScript sample.

## Suggested articles

- [Appliance image](../running/appliance.md)
- [Desktop app](../running/desktop-app.md)
