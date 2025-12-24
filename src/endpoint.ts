import { defineEndpoint } from '@directus/extensions-sdk';
import { MeiliSearch } from "meilisearch";
import { flattenAndStripHtml, waitForMeilisearchTask } from "./helpers";
import { MeilisearchSettings } from "./models";

export default defineEndpoint((router, { services, getSchema, logger }) => {
	const { ItemsService } = services;
	const TABLE_NAME = "meilisearch_settings";

	router.post('/reindex', async (req, res) => {
		// Security Check: Ensure only admins can trigger this
		// @ts-ignore
		const accountability = req.accountability;
		if (!accountability || !accountability.admin) {
			return res.status(403).json({ error: "Forbidden. Admin access required." });
		}

		logger.info("Manual reindex triggered via Endpoint.");

		try {
			const schema = await getSchema();
			const settingsService = new ItemsService(TABLE_NAME, { schema });
			const entity = await settingsService.readOne(1);

			if (!entity) return res.status(404).json({ error: "Meilisearch settings not found." });

			const meilisearchSettings = new MeilisearchSettings(entity);
			if (!meilisearchSettings.Host || !meilisearchSettings.Key) {
				return res.status(400).json({ error: "Meilisearch not configured." });
			}

			const client = new MeiliSearch({ host: meilisearchSettings.Host, apiKey: meilisearchSettings.Key });

			// Run reindex asynchronously (fire and forget)
			(async () => {
				for (const configuration of meilisearchSettings.CollectionsConfiguration) {
					logger.info(`Endpoint: Reindexing ${configuration.Collection}...`);
					try {
						let index = null;
						try {
							index = await client.getIndex(configuration.Collection);
						} catch {
							const task = await client.createIndex(configuration.Collection);
							const taskResult = await waitForMeilisearchTask(client, task);

							if (!taskResult.Success) {
								logger.warn(`[Meilisearch] Endpoint: Unable to create index for ${configuration.Collection}: ${taskResult.Message}`);
							} else {
								index = client.index(configuration.Collection);
							}
						}

						if (!index) continue;

						const itemsService = new ItemsService(configuration.Collection, { schema });
						const pageSize = 100;
						for (let offset = 0; ; offset += pageSize) {
							const entities = await itemsService.readByQuery({
								fields: configuration.Fields,
								filter: configuration.QueryFilter,
								limit: pageSize,
								offset
							}) as any[];

							if (!entities || !entities.length) break;

							const flattenedEntities = entities.map(entity => {
								const flattened = flattenAndStripHtml(entity, configuration.PreserveArrays);
								flattened.collection = configuration.Collection;
								return flattened;
							});

							await index.updateDocuments(flattenedEntities);
						}
						logger.info(`Endpoint: Finished reindexing ${configuration.Collection}.`);
					} catch (err: any) {
						logger.error(`Endpoint: Error reindexing ${configuration.Collection}: ${err}`);
						if (err.stack) {
							logger.error(err.stack);
						}
					}
				}
				logger.info("Endpoint: Full reindex complete.");
			})();

			return res.json({ message: "Reindexing started in background." });
		} catch (error: any) {
			logger.error(error);
			return res.status(500).json({ error: error.message });
		}
	});
});
