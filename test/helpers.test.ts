import { describe, expect, it } from "vitest";
import { flattenAndStripHtml, waitForMeilisearchTask } from "../src/helpers";

describe("flattenAndStripHtml", () => {
	it("flattens nested objects and strips HTML from supported text fields", () => {
		const result = flattenAndStripHtml({
			id: 1,
			title: "Hello",
			description: "<p>Hello <strong>world</strong></p>",
			author: {
				name: "Fahmi",
			},
		});

		expect(result).toEqual({
			id: 1,
			title: "Hello",
			description: "Hello world",
			"author.name": "Fahmi",
		});
	});

	it("removes nullish values and unwanted blocks/nodes payloads", () => {
		const result = flattenAndStripHtml({
			id: 2,
			content: {
				blocks: [{ id: "x" }],
			},
			blocks: {
				random: "remove me",
			},
			nodes: {
				random: "remove me too",
			},
			summary: "<p>Keep me</p>",
			subtitle: null,
		});

		expect(result).toEqual({
			id: 2,
			summary: "Keep me",
		});
	});

	it("preserves arrays when preserveArrays is enabled", () => {
		const result = flattenAndStripHtml(
			{
				id: 3,
				tags: ["quick", "vegan"],
				recipe: {
					ingredients: [
						{ name: "Salt" },
						{ name: "Pepper" },
					],
				},
			},
			true
		);

		expect(result).toEqual({
			id: 3,
			tags: ["quick", "vegan"],
			"recipe.ingredients": [
				{ name: "Salt" },
				{ name: "Pepper" },
			],
		});
	});
});

describe("waitForMeilisearchTask", () => {
	it("returns success when the Meilisearch task completes", async () => {
		const client = {
			tasks: {
				waitForTask: async () => ({ status: "succeeded" }),
			},
		} as any;

		const result = await waitForMeilisearchTask(client, { taskUid: 1 } as any);

		expect(result.Success).toBe(true);
		expect(result.Message).toBe("");
	});

	it("returns the task error message when the Meilisearch task fails", async () => {
		const client = {
			tasks: {
				waitForTask: async () => ({
					status: "failed",
					error: { message: "index creation failed" },
				}),
			},
		} as any;

		const result = await waitForMeilisearchTask(client, { taskUid: 2 } as any);

		expect(result.Success).toBe(false);
		expect(result.Message).toBe("index creation failed");
	});

	it("returns a fallback message when waiting for the task throws", async () => {
		const client = {
			tasks: {
				waitForTask: async () => {
					throw new Error("timeout");
				},
			},
		} as any;

		const result = await waitForMeilisearchTask(client, { taskUid: 3 } as any);

		expect(result.Success).toBe(false);
		expect(result.Message).toBe("timeout");
	});
});
