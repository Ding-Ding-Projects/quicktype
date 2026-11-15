let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
    try {
        const { input: code } = JSON.parse(input.trim());
        const header = [
            `// Generated with quicktype Studio on ${new Date().toISOString().slice(0, 10)}.`,
            "// Do not edit by hand; regenerate from the source sample instead.",
            "",
        ].join("\n");
        process.stdout.write(
            `${JSON.stringify({ ok: true, output: header + code })}\n`,
        );
    } catch (e) {
        process.stdout.write(
            `${JSON.stringify({ ok: false, error: String(e.message) })}\n`,
        );
    }
});
