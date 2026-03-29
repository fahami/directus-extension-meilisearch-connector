import { flattenAndStripHtml } from "./helpers";

export const MEILISEARCH_DOCUMENT_FILTER = "meilisearch.document";

export type MeilisearchSyncAction = "create" | "update" | "reindex";

export type IndexableDocument = Record<string, unknown>;

export interface MeilisearchDocumentFilterMeta {
	action: MeilisearchSyncAction;
	collection: string;
	event: typeof MEILISEARCH_DOCUMENT_FILTER;
	item: Record<string, unknown>;
}

export interface DirectusFilterEmitter {
	emitFilter?: (
		event: string,
		payload: IndexableDocument,
		meta: MeilisearchDocumentFilterMeta,
		context?: Record<string, unknown>
	) => Promise<IndexableDocument> | IndexableDocument;
}

export interface PrepareDocumentOptions {
	action: MeilisearchSyncAction;
	collection: string;
	context?: Record<string, unknown>;
	emitter?: DirectusFilterEmitter;
	item: Record<string, unknown>;
	preserveArrays?: boolean;
}

const isPlainObject = (value: unknown): value is IndexableDocument => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const applyDocumentTransform = async (
	document: IndexableDocument,
	options: Omit<PrepareDocumentOptions, "item" | "preserveArrays"> & { item: Record<string, unknown> }
): Promise<IndexableDocument> => {
	if (!options.emitter?.emitFilter) {
		return document;
	}

	const transformed = await options.emitter.emitFilter(MEILISEARCH_DOCUMENT_FILTER, document, {
		action: options.action,
		collection: options.collection,
		event: MEILISEARCH_DOCUMENT_FILTER,
		item: options.item,
	}, options.context);

	if (!isPlainObject(transformed)) {
		throw new Error(
			`[Meilisearch] ${MEILISEARCH_DOCUMENT_FILTER} must return an object for ${options.collection}`
		);
	}

	return transformed;
};

const prepareDocumentForIndexing = async (options: PrepareDocumentOptions): Promise<IndexableDocument> => {
	const document = flattenAndStripHtml(options.item, options.preserveArrays ?? false) as IndexableDocument;
	document.collection = options.collection;

	return applyDocumentTransform(document, {
		action: options.action,
		collection: options.collection,
		context: options.context,
		emitter: options.emitter,
		item: options.item,
	});
};

const prepareDocumentsForIndexing = async (
	items: Record<string, unknown>[],
	options: Omit<PrepareDocumentOptions, "item">
): Promise<IndexableDocument[]> => {
	return Promise.all(items.map((item) => prepareDocumentForIndexing({ ...options, item })));
};

export { applyDocumentTransform, prepareDocumentForIndexing, prepareDocumentsForIndexing };
