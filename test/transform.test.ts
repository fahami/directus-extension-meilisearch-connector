import { describe, expect, it, vi } from "vitest";
import {
	MEILISEARCH_DOCUMENT_FILTER,
	prepareDocumentForIndexing,
	prepareDocumentsForIndexing,
	type DirectusFilterEmitter,
} from "../src/transform";

describe("prepareDocumentForIndexing", () => {
	it("returns the flattened document when no emitter is provided", async () => {
		const document = await prepareDocumentForIndexing({
			action: "create",
			collection: "posts",
			item: {
				id: 1,
				title: "Hello",
				author: {
					name: "Fahmi",
				},
			},
		});

		expect(document).toEqual({
			id: 1,
			title: "Hello",
			"author.name": "Fahmi",
			collection: "posts",
		});
	});

	it("emits a transform hook and uses the returned document", async () => {
		const emitFilter = vi.fn(async (_event, payload, meta) => {
			expect(meta).toMatchObject({
				action: "update",
				collection: "posts",
				event: MEILISEARCH_DOCUMENT_FILTER,
			});

			return {
				...payload,
				date_created_timestamp: 1234567890,
			};
		});

		const emitter: DirectusFilterEmitter = { emitFilter };

		const document = await prepareDocumentForIndexing({
			action: "update",
			collection: "posts",
			context: { accountability: { role: "admin" }, database: { client: "knex" }, schema: { collections: [] } },
			emitter,
			item: {
				id: 1,
				title: "Hello",
				date_created: "2009-02-13T23:31:30Z",
			},
		});

		expect(emitFilter).toHaveBeenCalledOnce();
		expect(emitFilter).toHaveBeenCalledWith(
			MEILISEARCH_DOCUMENT_FILTER,
			expect.objectContaining({
				id: 1,
				title: "Hello",
				date_created: "2009-02-13T23:31:30Z",
				collection: "posts",
			}),
			expect.objectContaining({
				action: "update",
				collection: "posts",
				item: {
					id: 1,
					title: "Hello",
					date_created: "2009-02-13T23:31:30Z",
				},
			}),
			{
				accountability: { role: "admin" },
				database: { client: "knex" },
				schema: { collections: [] },
			}
		);
		expect(document).toEqual({
			id: 1,
			title: "Hello",
			date_created: "2009-02-13T23:31:30Z",
			collection: "posts",
			date_created_timestamp: 1234567890,
		});
	});

	it("supports formatting a date field through the transform hook", async () => {
		const emitter: DirectusFilterEmitter = {
			emitFilter: async (_event, payload, meta) => {
				if (meta.collection !== "posts" || typeof payload.date_created !== "string") {
					return payload;
				}

				return {
					...payload,
					date_created: payload.date_created.slice(0, 10),
				};
			},
		};

		const document = await prepareDocumentForIndexing({
			action: "reindex",
			collection: "posts",
			emitter,
			item: {
				id: 2,
				date_created: "2026-03-29T14:23:11.000Z",
			},
		});

		expect(document).toEqual({
			id: 2,
			date_created: "2026-03-29",
			collection: "posts",
		});
	});

	it("preserves arrays before the custom transform runs when preserveArrays is enabled", async () => {
		const emitFilter = vi.fn(async (_event, payload) => payload);

		const document = await prepareDocumentForIndexing({
			action: "reindex",
			collection: "recipes",
			emitter: { emitFilter },
			preserveArrays: true,
			item: {
				id: 3,
				tags: ["quick", "vegan"],
				ingredients: [
					{ name: "Salt" },
					{ name: "Pepper" },
				],
			},
		});

		expect(emitFilter).toHaveBeenCalledWith(
			MEILISEARCH_DOCUMENT_FILTER,
			expect.objectContaining({
				tags: ["quick", "vegan"],
				ingredients: [
					{ name: "Salt" },
					{ name: "Pepper" },
				],
				collection: "recipes",
			}),
			expect.objectContaining({
				action: "reindex",
				collection: "recipes",
			}),
			undefined
		);
		expect(document).toEqual({
			id: 3,
			tags: ["quick", "vegan"],
			ingredients: [
				{ name: "Salt" },
				{ name: "Pepper" },
			],
			collection: "recipes",
		});
	});

	it("runs the custom transform after flattening and HTML stripping", async () => {
		const emitFilter = vi.fn(async (_event, payload) => ({
			...payload,
			excerpt: `${payload.description} :: indexed`,
		}));

		const document = await prepareDocumentForIndexing({
			action: "create",
			collection: "articles",
			emitter: { emitFilter },
			item: {
				id: 4,
				description: "<p>Hello <strong>world</strong></p>",
				author: {
					name: "Fahmi",
				},
				blocks: {
					random: "should be removed",
				},
			},
		});

		expect(emitFilter).toHaveBeenCalledWith(
			MEILISEARCH_DOCUMENT_FILTER,
			expect.objectContaining({
				id: 4,
				description: "Hello world",
				"author.name": "Fahmi",
				collection: "articles",
			}),
			expect.objectContaining({
				action: "create",
				collection: "articles",
			}),
			undefined
		);
		expect(document).toEqual({
			id: 4,
			description: "Hello world",
			"author.name": "Fahmi",
			collection: "articles",
			excerpt: "Hello world :: indexed",
		});
		expect(document).not.toHaveProperty("blocks.random");
	});

	it("throws when the transform hook returns a non-object", async () => {
		const emitter: DirectusFilterEmitter = {
			emitFilter: async () => "invalid" as unknown as Record<string, unknown>,
		};

		await expect(
			prepareDocumentForIndexing({
				action: "create",
				collection: "posts",
				emitter,
				item: { id: 1 },
			})
		).rejects.toThrow(`${MEILISEARCH_DOCUMENT_FILTER} must return an object`);
	});

	it("throws when the transform hook returns a non-plain object", async () => {
		const emitter: DirectusFilterEmitter = {
			emitFilter: async () => new Date("2026-03-29T00:00:00.000Z") as unknown as Record<string, unknown>,
		};

		await expect(
			prepareDocumentForIndexing({
				action: "create",
				collection: "posts",
				emitter,
				item: { id: 1 },
			})
		).rejects.toThrow(`${MEILISEARCH_DOCUMENT_FILTER} must return an object`);
	});
});

describe("prepareDocumentsForIndexing", () => {
	it("applies the transform hook to every reindexed document", async () => {
		const emitFilter = vi.fn(async (_event, payload) => {
			return {
				...payload,
				transformed: true,
			};
		});

		const documents = await prepareDocumentsForIndexing(
			[
				{ id: 1, title: "A" },
				{ id: 2, title: "B" },
			],
			{
				action: "reindex",
				collection: "posts",
				emitter: { emitFilter },
			}
		);

		expect(emitFilter).toHaveBeenCalledTimes(2);
		expect(emitFilter).toHaveBeenNthCalledWith(
			1,
			MEILISEARCH_DOCUMENT_FILTER,
			expect.objectContaining({ id: 1, title: "A", collection: "posts" }),
			expect.objectContaining({
				action: "reindex",
				collection: "posts",
				item: { id: 1, title: "A" },
			}),
			undefined
		);
		expect(emitFilter).toHaveBeenNthCalledWith(
			2,
			MEILISEARCH_DOCUMENT_FILTER,
			expect.objectContaining({ id: 2, title: "B", collection: "posts" }),
			expect.objectContaining({
				action: "reindex",
				collection: "posts",
				item: { id: 2, title: "B" },
			}),
			undefined
		);
		expect(documents).toEqual([
			{ id: 1, title: "A", collection: "posts", transformed: true },
			{ id: 2, title: "B", collection: "posts", transformed: true },
		]);
	});

	it("keeps valid documents when one transform fails", async () => {
		const emitFilter = vi.fn(async (_event, payload) => {
			if (payload.id === 2) {
				throw new Error("boom");
			}

			return {
				...payload,
				transformed: true,
			};
		});

		const documents = await prepareDocumentsForIndexing(
			[
				{ id: 1, title: "A" },
				{ id: 2, title: "B" },
				{ id: 3, title: "C" },
			],
			{
				action: "reindex",
				collection: "posts",
				emitter: { emitFilter },
			}
		);

		expect(emitFilter).toHaveBeenCalledTimes(3);
		expect(documents).toEqual([
			{ id: 1, title: "A", collection: "posts", transformed: true },
			{ id: 3, title: "C", collection: "posts", transformed: true },
		]);
	});
});
