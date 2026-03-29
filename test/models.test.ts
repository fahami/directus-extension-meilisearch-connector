import { describe, expect, it } from "vitest";
import { MeilisearchSettings, MeilisearchTaskResult } from "../src/models";

describe("MeilisearchSettings", () => {
	it("maps raw Directus settings into the runtime shape", () => {
		const settings = new MeilisearchSettings({
			host: "http://localhost:7700",
			api_key: "masterKey",
			collections_configuration: [
				{
					collection: "posts",
					queryFilter: { status: { _eq: "published" } },
					actionFilter: { status: { _eq: "published" } },
					fields: ["id", "title"],
					preserveArrays: true,
				},
			],
		});

		expect(settings.Host).toBe("http://localhost:7700");
		expect(settings.Key).toBe("masterKey");
		expect(settings.CollectionsConfiguration).toEqual([
			{
				Collection: "posts",
				QueryFilter: { status: { _eq: "published" } },
				ActionFilter: { status: { _eq: "published" } },
				Fields: ["id", "title"],
				PreserveArrays: true,
			},
		]);
	});

	it("defaults preserveArrays to false when omitted", () => {
		const settings = new MeilisearchSettings({
			host: "http://localhost:7700",
			api_key: "masterKey",
			collections_configuration: [
				{
					collection: "recipes",
					queryFilter: {},
					actionFilter: {},
					fields: ["id", "name"],
				},
			],
		});

		expect(settings.CollectionsConfiguration[0]?.PreserveArrays).toBe(false);
	});

	it("handles missing collections configuration", () => {
		const settings = new MeilisearchSettings({
			host: "http://localhost:7700",
			api_key: "masterKey",
		});

		expect(settings.CollectionsConfiguration).toEqual([]);
	});
});

describe("MeilisearchTaskResult", () => {
	it("stores success state and message", () => {
		const result = new MeilisearchTaskResult(true, "ok");

		expect(result.Success).toBe(true);
		expect(result.Message).toBe("ok");
	});
});
