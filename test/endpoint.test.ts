import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareDocumentsForIndexing = vi.fn();
const waitForMeilisearchTask = vi.fn();

let meiliClientMock: {
	createIndex: ReturnType<typeof vi.fn>;
	getIndex: ReturnType<typeof vi.fn>;
	index: ReturnType<typeof vi.fn>;
};

vi.mock("@directus/extensions-sdk", () => ({
	defineEndpoint: (register: unknown) => register,
	defineHook: (register: unknown) => register,
}));

vi.mock("../src/transform", () => ({
	prepareDocumentsForIndexing,
}));

vi.mock("../src/helpers", () => ({
	waitForMeilisearchTask,
}));

vi.mock("meilisearch", () => ({
	MeiliSearch: vi.fn(function MeiliSearch(this: unknown) {
		return meiliClientMock;
	}),
}));

const { default: registerEndpoint } = await import("../src/endpoint");
const { default: registerHook } = await import("../src/index");
const endpointHandler = registerEndpoint as unknown as (
	router: { post: (path: string, handler: (req: any, res: any) => Promise<unknown>) => void },
	context: Record<string, unknown>
) => void;

const createResponse = () => {
	const response = {
		status: vi.fn(),
		json: vi.fn(),
	};

	response.status.mockReturnValue(response);
	response.json.mockReturnValue(response);

	return response;
};

const createItemsServiceCtor = (factory: (collection: string) => Record<string, unknown>) => {
	return vi.fn(function ItemsService(this: unknown, collection: string) {
		return factory(collection);
	});
};

const flushMicrotasks = async () => {
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("endpoint /reindex", () => {
	let postHandler: ((req: any, res: any) => Promise<unknown>) | undefined;

	beforeEach(() => {
		postHandler = undefined;
		prepareDocumentsForIndexing.mockReset();
		waitForMeilisearchTask.mockReset();

		meiliClientMock = {
			createIndex: vi.fn(),
			getIndex: vi.fn(),
			index: vi.fn(),
		};
	});

	it("rejects non-admin requests", async () => {
		endpointHandler(
			{
				post: vi.fn((path, handler) => {
					expect(path).toBe("/reindex");
					postHandler = handler;
				}),
			},
			{
				emitter: {},
				getSchema: vi.fn(),
				logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
				services: { ItemsService: vi.fn() },
			}
		);

		const response = createResponse();

		await postHandler?.({ accountability: { admin: false } }, response);

		expect(response.status).toHaveBeenCalledWith(403);
		expect(response.json).toHaveBeenCalledWith({
			error: "Forbidden. Admin access required.",
		});
	});

	it("returns 404 when Meilisearch settings do not exist", async () => {
		const settingsReadOne = vi.fn(async () => null);
		const ItemsService = createItemsServiceCtor(() => ({
			readOne: settingsReadOne,
		}));

		endpointHandler(
			{
				post: vi.fn((_path, handler) => {
					postHandler = handler;
				}),
			},
			{
				emitter: {},
				getSchema: vi.fn(async () => ({ collections: [] })),
				logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
				services: { ItemsService },
			}
		);

		const response = createResponse();

		await postHandler?.({ accountability: { admin: true } }, response);

		expect(ItemsService).toHaveBeenCalledWith("meilisearch_settings", {
			schema: { collections: [] },
		});
		expect(response.status).toHaveBeenCalledWith(404);
		expect(response.json).toHaveBeenCalledWith({
			error: "Meilisearch settings not found.",
		});
	});

	it("starts background reindexing and transforms documents before indexing", async () => {
		const updateDocuments = vi.fn(async () => undefined);
		const index = { updateDocuments };

		const settings = {
			host: "http://localhost:7700",
			api_key: "masterKey",
			collections_configuration: [
				{
					collection: "posts",
					fields: ["id", "title"],
					queryFilter: { status: { _eq: "published" } },
					preserveArrays: true,
				},
			],
		};

		const readByQuery = vi
			.fn()
			.mockResolvedValueOnce([{ id: 1, title: "Hello" }])
			.mockResolvedValueOnce([]);

		const ItemsService = createItemsServiceCtor((collection: string) => {
			if (collection === "meilisearch_settings") {
				return {
					readOne: vi.fn(async () => settings),
				};
			}

			return {
				readByQuery,
			};
		});

		const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
		const emitter = { emitFilter: vi.fn() };
		const schema = { collections: ["posts"] };

		prepareDocumentsForIndexing.mockResolvedValue([
			{ id: 1, title: "Hello", collection: "posts", transformed: true },
		]);

		meiliClientMock.getIndex.mockResolvedValue(index);
		meiliClientMock.index.mockReturnValue(index);

		endpointHandler(
			{
				post: vi.fn((_path, handler) => {
					postHandler = handler;
				}),
			},
			{
				emitter,
				getSchema: vi.fn(async () => schema),
				logger,
				services: { ItemsService },
			}
		);

		const response = createResponse();

		await postHandler?.({ accountability: { admin: true } }, response);
		await flushMicrotasks();

		expect(response.json).toHaveBeenCalledWith({
			message: "Reindexing started in background.",
		});
		expect(readByQuery).toHaveBeenCalledWith({
			fields: ["id", "title"],
			filter: { status: { _eq: "published" } },
			limit: 100,
			offset: 0,
		});
		expect(prepareDocumentsForIndexing).toHaveBeenCalledWith(
			[{ id: 1, title: "Hello" }],
			{
				action: "reindex",
				collection: "posts",
				context: { accountability: { admin: true }, schema },
				emitter,
				preserveArrays: true,
			}
		);
		expect(updateDocuments).toHaveBeenCalledWith([
			{ id: 1, title: "Hello", collection: "posts", transformed: true },
		]);
		expect(logger.info).toHaveBeenCalledWith("Endpoint: Full reindex complete.");
	});
});

describe("hook items.create", () => {
	it("applies ActionFilter before indexing newly created items", async () => {
		const actionHandlers = new Map<string, (...args: any[]) => unknown>();
		const itemsReadMany = vi.fn(async () => []);
		const ItemsService = createItemsServiceCtor((collection: string) => {
			if (collection === "meilisearch_settings") {
				return {
					readOne: vi.fn(async () => ({
						host: "http://localhost:7700",
						api_key: "masterKey",
						collections_configuration: [
							{
								collection: "posts",
								fields: ["id", "title"],
								actionFilter: { status: { _eq: "published" } },
							},
						],
					})),
				};
			}

			return {
				readMany: itemsReadMany,
			};
		});

		await registerHook(
			{
				action: (name: string, handler: (...args: any[]) => unknown) => {
					actionHandlers.set(name, handler);
				},
				embed: vi.fn(),
				filter: vi.fn(),
				init: vi.fn(),
				schedule: vi.fn(),
			} as any,
			{
				database: vi.fn(),
				emitter: {},
				getSchema: vi.fn(async () => ({ collections: [] })),
				logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
				services: {
					CollectionsService: vi.fn(),
					FieldsService: vi.fn(),
					ItemsService,
				},
			} as any
		);

		await actionHandlers.get("meilisearch_settings.items.update")?.(
			{ payload: {} },
			{ schema: { collections: [] } }
		);

		await actionHandlers.get("items.create")?.(
			{ collection: "posts", key: 1 },
			{
				accountability: { admin: true },
				schema: { collections: [] },
			}
		);

		expect(itemsReadMany).toHaveBeenCalledWith([1], {
			fields: ["id", "title"],
			filter: { status: { _eq: "published" } },
		});
		expect(meiliClientMock.index).not.toHaveBeenCalled();
	});
});
