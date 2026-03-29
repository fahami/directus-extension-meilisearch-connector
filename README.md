# Directus Meilisearch Extension

A powerful Directus extension to synchronize your content seamlessly with [Meilisearch](https://www.meilisearch.com/). It provides real-time updates, advanced filtering, and instant search capabilities for your Directus projects.

## 🌟 Key Features

*   **Real-Time Synchronization:** Create, update, or delete items in Directus, and they appear in Meilisearch instantly.
*   **Hot-Reloading:** Change your search settings on the fly. No need to restart your server when adding new collections or changing filters.
*   **Smart Array Handling:** Option to preserve JSON arrays (like tags or ingredients list) for better faceting and filtering.
*   **Zero-Config Setup:** Automatically creates the necessary settings collection in your Directus Admin Panel.
*   **Manual Reindexing:** Trigger a full reindex via the Admin Panel UI, CLI, or API.

## 🚀 Getting Started

### 1. Installation
Install the extension in your Directus project.

```bash
npm install directus-extension-meilisearch-connector
# or
pnpm add directus-extension-meilisearch-connector
```

### 2. Configuration
Once installed and Directus is running, navigate to the **Content** module. You will see a new collection called **"Meilisearch Settings"**.

1.  **Host:** Enter your Meilisearch URL (e.g., `http://localhost:7700` or `http://meilisearch:7700` if using Docker/Podman).
2.  **API Key:** Enter your Meilisearch Master Key.
3.  **Collections Configuration:** Define which collections to index using JSON.

### 3. Example Configuration
In the **Collections Configuration** field, add your rules:

```json
[
  {
    "collection": "recipes",
    "fields": ["id", "title", "description", "ingredients"],
    "queryFilter": { "status": { "_eq": "published" } },
    "actionFilter": { "status": { "_eq": "published" } },
    "preserveArrays": true
  }
]
```

*   **fields**: List of Directus fields to send to Meilisearch.
*   **queryFilter**: (Optional) Filter items during the initial reindex (e.g., only published items).
*   **actionFilter**: (Optional) Filter items during real-time updates.
*   **preserveArrays**: Set to `true` to keep lists (like tags) as arrays. If `false` (default), they are flattened.

## 🔄 Reindexing Data

If you have existing data, you can sync it all at once using one of these methods:

*   **Admin Panel (Easiest):** In the *Meilisearch Settings* item, toggle the **"Start Reindexing"** switch to **ON** and save. It will run in the background and turn itself off when done.
*   **API:** Send a POST request to `/meilisearch/reindex` (requires Admin Token).
*   **CLI:** Run `npx directus meilisearch:reindex` in your server terminal.

## 🪝 Document Transform Hook

If you need to change the document before it is sent to Meilisearch, this extension emits a custom Directus filter event named `meilisearch.document`.

This is intended for advanced use cases such as:

*   adding computed fields like timestamps or slugs
*   renaming fields before indexing
*   formatting values, for example converting a date to `yyyy-MM-dd`
*   removing fields that should not be searchable

### How It Works

The indexing flow is:

```text
Directus item -> flattenAndStripHtml() -> meilisearch.document -> Meilisearch
```

The custom filter runs for:

*   real-time create sync
*   real-time update sync
*   full reindex

### Setup

1. Install this extension as usual.
2. Configure `collections_configuration` in the **Meilisearch Settings** collection.
3. Create a separate Directus hook extension in your project.
4. In that hook extension, listen to `meilisearch.document`.
5. Return the transformed document.

### Companion Hook Example

```ts
import { defineHook } from "@directus/extensions-sdk";

export default defineHook(({ filter }) => {
	filter("meilisearch.document", (doc, meta) => {
		if (meta.collection !== "posts") return doc;

		if (typeof doc.date_created === "string") {
			return {
				...doc,
				date_created: doc.date_created.slice(0, 10),
				date_created_timestamp: Math.floor(new Date(doc.date_created).getTime() / 1000),
			};
		}

		return doc;
	});
});
```

In this example:

*   `date_created` is reformatted to `yyyy-MM-dd`
*   `date_created_timestamp` is added as a computed field

### Available Metadata

Your custom filter receives:

*   `doc`: the flattened document that would be sent to Meilisearch
*   `meta.action`: one of `create`, `update`, or `reindex`
*   `meta.collection`: the Directus collection name
*   `meta.item`: the original item before indexing

The Directus filter context is also forwarded, so companion hooks can use values such as `database`, `schema`, and `accountability` when needed.

### Important Notes

*   This is a code-based extension point, not a Directus Flow.
*   If your transform returns a non-object, indexing will fail for that document.
*   If you do not register a `meilisearch.document` hook, indexing behaves exactly as before.

## 👏 Credits

This project is an improved version of the [directus-extension-meilisearch-integration](https://github.com/Healios/directus-extension-meilisearch-integration) by Healios.

**Major improvements in this version:**
*   Eliminated the need to restart the server when changing settings.
*   Added an API Endpoint and UI Toggle for reindexing.
*   Added support for preserving array structures.
*   Improved error handling and system stability.
