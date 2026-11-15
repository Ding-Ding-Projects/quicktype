// Reads one JSON request line from stdin, writes one JSON answer line.
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
    try {
        const { command, input: code } = JSON.parse(input.trim());
        if (command !== "stats") throw new Error(`unknown command ${command}`);
        const lines = code.split("\n");
        const blank = lines.filter((l) => l.trim() === "").length;
        const types = (
            code.match(
                /\b(class|struct|interface|enum|type|data class|record)\s+[A-Z]\w*/g,
            ) ?? []
        ).length;
        process.stdout.write(
            `${JSON.stringify({ ok: true, output: `${lines.length} lines (${blank} blank), about ${types} declared types` })}\n`,
        );
    } catch (e) {
        process.stdout.write(
            `${JSON.stringify({ ok: false, error: String(e.message) })}\n`,
        );
    }
});
