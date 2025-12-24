import { RawCollection } from "@directus/types";

export const MeilisearchSettingsTable =
<RawCollection>{
    "collection": "meilisearch_settings",
    "meta": {
        "collection": "meilisearch_settings",
        "icon": "search",
        "note": null,
        "display_template": null,
        "singleton": true,
        "translations": null,
        "archive_field": null,
        "archive_app_filter": true,
        "archive_value": null,
        "unarchive_value": null,
        "sort_field": null,
        "accountability": "all",
        "color": null,
        "item_duplication_fields": null,
        "sort": null,
        "group": null,
        "collapse": "open",
        "preview_url": null,
        "versioning": false
    },
    "schema": {
        "schema": "public",
        "name": "meilisearch_settings",
        "comment": null
    },
    "fields": [
        {
            "collection": "meilisearch_settings",
            "field": "id",
            "type": "integer",
            "schema": {
                "name": "id",
                "table": "meilisearch_settings",
                "schema": "public",
                "data_type": "integer",
                "is_nullable": false,
                "generation_expression": null,
                "default_value": "nextval('meilisearch_settings_id_seq'::regclass)",
                "is_generated": false,
                "max_length": null,
                "comment": null,
                "numeric_precision": 32,
                "numeric_scale": 0,
                "is_unique": true,
                "is_primary_key": true,
                "has_auto_increment": true,
                "foreign_key_schema": null,
                "foreign_key_table": null,
                "foreign_key_column": null
            },
            "meta": {
                "collection": "meilisearch_settings",
                "field": "id",
                "special": null,
                "interface": "input",
                "options": null,
                "display": null,
                "display_options": null,
                "readonly": true,
                "hidden": true,
                "sort": 1,
                "width": "full",
                "translations": null,
                "note": null,
                "conditions": null,
                "required": false,
                "group": null,
                "validation": null,
                "validation_message": null
            }
        },
        {
            "collection": "meilisearch_settings",
            "field": "host",
            "type": "string",
            "schema": {
                "name": "host",
                "table": "meilisearch_settings",
                "schema": "public",
                "data_type": "character varying",
                "is_nullable": true,
                "generation_expression": null,
                "default_value": null,
                "is_generated": false,
                "max_length": 255,
                "comment": null,
                "numeric_precision": null,
                "numeric_scale": null,
                "is_unique": false,
                "is_primary_key": false,
                "has_auto_increment": false,
                "foreign_key_schema": null,
                "foreign_key_table": null,
                "foreign_key_column": null
            },
            "meta": {
                "collection": "meilisearch_settings",
                "field": "host",
                "special": null,
                "interface": "input",
                "options": {
                    "trim": true,
                    "placeholder": "https://meilisearch-endpoint.net"
                },
                "display": null,
                "display_options": null,
                "readonly": false,
                "hidden": false,
                "sort": 7,
                "width": "half",
                "translations": null,
                "note": null,
                "conditions": null,
                "required": true,
                "group": null,
                "validation": null,
                "validation_message": null
            }
        },
        {
            "collection": "meilisearch_settings",
            "field": "api_key",
            "type": "string",
            "schema": {
                "name": "api_key",
                "table": "meilisearch_settings",
                "schema": "public",
                "data_type": "character varying",
                "is_nullable": true,
                "generation_expression": null,
                "default_value": null,
                "is_generated": false,
                "max_length": 255,
                "comment": null,
                "numeric_precision": null,
                "numeric_scale": null,
                "is_unique": false,
                "is_primary_key": false,
                "has_auto_increment": false,
                "foreign_key_schema": null,
                "foreign_key_table": null,
                "foreign_key_column": null
            },
            "meta": {
                "collection": "meilisearch_settings",
                "field": "api_key",
                "special": null,
                "interface": "input",
                "options": {
                    "trim": true,
                    "placeholder": "Your Meilisearch API Key"
                },
                "display": null,
                "display_options": null,
                "readonly": false,
                "hidden": false,
                "sort": 8,
                "width": "half",
                "translations": null,
                "note": null,
                "conditions": null,
                "required": true,
                "group": null,
                "validation": null,
                "validation_message": null
            }
        },
        {
            "collection": "meilisearch_settings",
            "field": "collections_configuration",
            "type": "json",
            "schema": {
                "name": "collections_configuration",
                "table": "meilisearch_settings",
                "schema": "public",
                "data_type": "json",
                "is_nullable": true,
                "generation_expression": null,
                "default_value": [],
                "is_generated": false,
                "max_length": null,
                "comment": null,
                "numeric_precision": null,
                "numeric_scale": null,
                "is_unique": false,
                "is_primary_key": false,
                "has_auto_increment": false,
                "foreign_key_schema": null,
                "foreign_key_table": null,
                "foreign_key_column": null
            },
            "meta": {
                "collection": "meilisearch_settings",
                "field": "collections_configuration",
                "special": [
                    "cast-json"
                ],
                "interface": "input-code",
                "options": {
                    "placeholder": `[
  {
    "collection": "articles",
    "fields": ["title", "content", "tags"],
    "queryFilter": {"status": {"_eq": "published"}},
    "actionFilter": {"status": {"_eq": "published"}},
    "preserveArrays": true
  }
]`
                },
                "display": null,
                "display_options": null,
                "readonly": false,
                "hidden": false,
                "sort": 9,
                "width": "full",
                "translations": null,
                "note": "Define collection, fields, filters, and optional 'preserveArrays' (bool).",
                "conditions": null,
                "required": false,
                "group": null,
                "validation": null,
                "validation_message": null
            }
        },
        {
            "collection": "meilisearch_settings",
            "field": "force_reindex",
            "type": "boolean",
            "schema": {
                "name": "force_reindex",
                "table": "meilisearch_settings",
                "schema": "public",
                "data_type": "boolean",
                "is_nullable": true,
                "generation_expression": null,
                "default_value": false,
                "is_generated": false,
                "max_length": null,
                "comment": null,
                "numeric_precision": null,
                "numeric_scale": null,
                "is_unique": false,
                "is_primary_key": false,
                "has_auto_increment": false,
                "foreign_key_schema": null,
                "foreign_key_table": null,
                "foreign_key_column": null
            },
            "meta": {
                "collection": "meilisearch_settings",
                "field": "force_reindex",
                "special": null,
                "interface": "boolean",
                "options": {
                    "label": "Start Reindexing"
                },
                "display": "boolean",
                "display_options": null,
                "readonly": false,
                "hidden": false,
                "sort": 10,
                "width": "full",
                "translations": null,
                "note": "Toggle this on and save to trigger a full reindex. It will turn off automatically when done.",
                "conditions": null,
                "required": false,
                "group": null,
                "validation": null,
                "validation_message": null
            }
        },
        {
            "collection": "meilisearch_settings",
            "field": "endpoint_notice",
            "type": "alias",
            "schema": null,
            "meta": {
                "collection": "meilisearch_settings",
                "field": "endpoint_notice",
                "special": ["alias", "no-data"],
                "interface": "presentation-notice",
                "options": {
                    "color": "success",
                    "text": "You can also trigger reindexing via API: POST /meilisearch/reindex"
                },
                "display": null,
                "readonly": false,
                "hidden": false,
                "sort": 11,
                "width": "full"
            }
        }
    ]
};