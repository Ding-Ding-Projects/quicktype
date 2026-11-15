# Appliance image

A small system image that boots straight into quicktype Studio, the way a dedicated appliance does. Flash the BIOS image to a spare machine's disk or boot the EFI ISO in a virtual machine.

## How to use it

After boot the console shows the address to open. The status page is at /appliance. Updating means flashing or importing the next appliance release, which carries the system and Studio together.

## When something goes wrong

If the machine gets no network address, the console shows no address; check the cable or the virtual machine's network setting.

## Privacy and security

The appliance serves only the Studio page on port 8080 and has no remote login.

## How to check it works

Boot the ISO in a virtual machine, open the address, and generate code.

## Suggested articles

- [Self-hosted container](../running/self-hosted.md)
