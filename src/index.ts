import { defineHook } from "@directus/extensions-sdk";
import { MeiliSearch } from "meilisearch";
import { MeilisearchSettingsTable } from "./tables";
import { flattenAndStripHtml, waitForMeilisearchTask } from "./helpers";
import { MeilisearchSettings } from "./models";
import { SchemaOverview } from "@directus/types";

export default defineHook(async ({ init, action }, { logger, services, getSchema, database }) => {
    const TABLE_NAME = "meilisearch_settings";
    const { CollectionsService, ItemsService, FieldsService } = services;

    // --- State Management ---
    // We keep the settings in memory so we don't hit the DB on every request.
    let cachedSettings: MeilisearchSettings | null = null;
    let client: MeiliSearch | null = null;

    // Helper to refresh settings from DB
    const refreshSettings = async (schema: SchemaOverview) => {
        try {
            const settingsService = new ItemsService(TABLE_NAME, { schema });
            const entity = await settingsService.readOne(1);
            if (entity) {
                cachedSettings = new MeilisearchSettings(entity);
                if (cachedSettings.Host && cachedSettings.Key) {
                    client = new MeiliSearch({ host: cachedSettings.Host, apiKey: cachedSettings.Key });
                    logger.info("Meilisearch settings reloaded.");
                } else {
                    client = null;
                }
            }
        } catch (_e) {
            // Table might not exist yet, ignore
        }
    };

    // --- Reindexing Logic ---
    const runReindex = async (schema: SchemaOverview) => {
        if (!cachedSettings || !client) {
            await refreshSettings(schema);
            if (!cachedSettings || !client) return;
        }

        logger.info("Starting Meilisearch reindexing process...");
        logger.info(`Client config : ${client.config.apiKey} `)

        try {
            for (const configuration of cachedSettings.CollectionsConfiguration) {
                logger.info(`Reindexing collection: ${configuration.Collection}`);
                
                let index = null;
                try {
                    index = await client.getIndex(configuration.Collection);
                } catch {
                    const task = await client.createIndex(configuration.Collection);
                    const taskResult = await waitForMeilisearchTask(client, task);
                    
                    if (!taskResult.Success) {
                        logger.warn(`[Meilisearch] Unable to create index for ${configuration.Collection}: ${taskResult.Message}`);
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
                    });
                    if (!entities || !entities.length) break;

                    const flattenedEntities = entities.map(entity => {
                        const flattened = flattenAndStripHtml(entity, configuration.PreserveArrays);
                        flattened.collection = configuration.Collection;
                        return flattened;
                    });

                    await index.updateDocuments(flattenedEntities);
                }
            }
            logger.info("Finished reindexing.");
            
            // Reset force_reindex flag using raw database query to avoid permission issues
            await database(TABLE_NAME).where('id', 1).update({ force_reindex: false });

        } catch (error: any) {
            logger.error(`Reindexing failed: ${error}`);
            if (error.stack) {
                logger.error(error.stack);
            }
        }
    };

    // --- CLI Command ---
    init("cli.before", ({ program }) => {
        program.command("meilisearch:reindex")
            .description("Goes through each collection and updates each collection's index.")
            .action(async () => {
                const schema = await getSchema();
                await refreshSettings(schema);
                await runReindex(schema);
            });
    });

    // --- Server Startup ---
    action("server.start", async () => {
        const schema = await getSchema();
        const collectionService = new CollectionsService({ schema });
        const collections = await collectionService.readByQuery();

        // Create Table if missing
        if (collections.find((c) => c.collection === TABLE_NAME) === undefined) {
            await collectionService.createOne(MeilisearchSettingsTable);
            logger.info("Meilisearch Settings table created.");
        } else {
            // Ensure schema is up to date (check for missing fields)
            const fieldsService = new FieldsService({ schema });
            const existingFields = await fieldsService.readAll(TABLE_NAME);

            if (MeilisearchSettingsTable.fields) {
                for (const fieldDef of MeilisearchSettingsTable.fields) {
                    const existing = existingFields.find((f) => f.field === fieldDef.field);
                    if (!existing) {
                        try {
                            // FieldsService.createField(collection: string, field: Field)
                            // We pass the full field definition object here.
                            await fieldsService.createField(TABLE_NAME, fieldDef as any);
                            logger.info(`Added missing field: ${fieldDef.field}`);
                        } catch (error) {
                            logger.warn(`Failed to add field ${fieldDef.field}: ${error}`);
                        }
                    }
                }
            }
        }

        // Initial Load
        await refreshSettings(schema);
        logger.info("Meilisearch Integration Ready.");
    });

    // --- Settings Updates ---
    // Listen for changes to the settings table itself to reload cache or trigger reindex
    action(`${TABLE_NAME}.items.update`, async (meta, { schema }) => {
        if (!schema) return;
        await refreshSettings(schema);
        
        if (meta.payload.force_reindex === true) {
            runReindex(schema);
        }
    });

    // --- GLOBAL Data Sync Hooks ---
    // These fire for ALL collections. We filter inside efficiently.

    action("items.create", async (meta, { schema, accountability }) => {
        if (!client || !cachedSettings || !schema) return;
        
        // Find config for this collection
        const config = cachedSettings.CollectionsConfiguration.find(c => c.Collection === meta.collection);
        if (!config) return; // Not a configured collection, ignore.

        try {
            const itemsService = new ItemsService(config.Collection, { schema, accountability });
            const entities = await itemsService.readMany([meta.key], { fields: config.Fields });
            if (entities.length === 0) return;

            const flattened = flattenAndStripHtml(entities[0], config.PreserveArrays);
            flattened.collection = config.Collection;
            await client.index(config.Collection).addDocuments([flattened]);
            logger.info(`[Meilisearch] Added ${config.Collection} ID ${meta.key}`);
        } catch (err: any) {
            logger.error(`[Meilisearch] Create Error: ${err}`);
            if (err.stack) {
                logger.error(err.stack);
            }
        }
    });

    action("items.update", async (meta, { schema, accountability }) => {
        if (!client || !cachedSettings || !schema) return;

        const config = cachedSettings.CollectionsConfiguration.find(c => c.Collection === meta.collection);
        if (!config) return;

        try {
            const itemsService = new (ItemsService as any)(config.Collection, { schema, accountability });
            const index = client.index(config.Collection);

            // Check if the item still matches filters
            const entities = await itemsService.readMany(meta.keys, { fields: config.Fields, filter: config.ActionFilter });
            
            // If it no longer matches (or was "soft deleted" via status), remove it
            if (entities.length === 0) {
                await index.deleteDocuments(meta.keys);
                return;
            }

            const flattened = flattenAndStripHtml(entities[0], config.PreserveArrays);
            flattened.collection = config.Collection;
            await index.updateDocuments([flattened]);
            logger.info(`[Meilisearch] Updated ${config.Collection} ID ${meta.keys[0]}`);
        } catch (err: any) {
            logger.error(`[Meilisearch] Update Error: ${err}`);
            if (err.stack) {
                logger.error(err.stack);
            }
        }
    });

    action("items.delete", async (meta) => {
        if (!client || !cachedSettings) return;

        const config = cachedSettings.CollectionsConfiguration.find(c => c.Collection === meta.collection);
        if (!config) return;

        try {
            await client.index(config.Collection).deleteDocuments(meta.keys);
            logger.info(`[Meilisearch] Deleted ${config.Collection} ID ${meta.keys[0]}`);
        } catch (err: any) {
            logger.error(`[Meilisearch] Delete Error: ${err}`);
            if (err.stack) {
                logger.error(err.stack);
            }
        }
    });
});