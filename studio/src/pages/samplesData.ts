export interface Sample {
    id: string;
    title: string;
    kind: "json" | "schema" | "typescript";
    topLevel: string;
    text: string;
}

export const SAMPLES: Sample[] = [
    {
        id: "pokedex",
        title: "Pokédex entries",
        kind: "json",
        topLevel: "Pokedex",
        text: JSON.stringify(
            {
                pokemon: [
                    {
                        id: 1,
                        num: "001",
                        name: "Bulbasaur",
                        type: ["Grass", "Poison"],
                        height: "0.71 m",
                        spawn_chance: 0.69,
                        next_evolution: [{ num: "002", name: "Ivysaur" }],
                    },
                ],
            },
            null,
            2,
        ),
    },
    {
        id: "order",
        title: "Shop order",
        kind: "json",
        topLevel: "Order",
        text: JSON.stringify(
            {
                order: 1042,
                placedAt: "2026-11-15T10:30:00Z",
                paid: true,
                customer: { name: "Ada", email: "ada@example.com" },
                items: [{ sku: "QT-12", qty: 2, price: 9.5 }],
            },
            null,
            2,
        ),
    },
    {
        id: "weather",
        title: "Weather report",
        kind: "json",
        topLevel: "Forecast",
        text: JSON.stringify(
            {
                city: "Hong Kong",
                updated: "2026-11-15T09:00:00+08:00",
                days: [
                    { date: "2026-11-15", high: 26, low: 21, summary: "sunny" },
                    {
                        date: "2026-11-16",
                        high: 24,
                        low: 20,
                        summary: "cloudy",
                    },
                ],
            },
            null,
            2,
        ),
    },
    {
        id: "person-schema",
        title: "Person (JSON Schema)",
        kind: "schema",
        topLevel: "Person",
        text: JSON.stringify(
            {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                required: ["name"],
                properties: {
                    name: { type: "string" },
                    age: { type: "integer", minimum: 0 },
                    email: { type: "string", format: "email" },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            null,
            2,
        ),
    },
    {
        id: "ts-user",
        title: "User (TypeScript)",
        kind: "typescript",
        topLevel: "User",
        text: 'export interface User {\n    id: number;\n    name: string;\n    roles: ("admin" | "member")[];\n    lastSeen?: string;\n}\n',
    },
];
