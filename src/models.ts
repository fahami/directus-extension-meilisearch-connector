import { Filter } from "@directus/types";

class CollectionConfiguration
{
    constructor(collection: string, queryFilter: Filter, actionFilter: object, fields: string[], preserveArrays: boolean = false)
    {
        this.Collection = collection;
        this.QueryFilter = queryFilter;
        this.ActionFilter = actionFilter;
        this.Fields = fields;
        this.PreserveArrays = preserveArrays;
    }

    public Collection: string;
    public QueryFilter: Filter;
    public ActionFilter: object;
    public Fields: string[];
    public PreserveArrays: boolean;
}

export class MeilisearchSettings
{
    constructor(data: object)
    {
        this.Host = (data as any).host;
        this.Key = (data as any).api_key;

        const configurationData = (data as any).collections_configuration || [];
        this.CollectionsConfiguration = configurationData.map((config: any) => 
            new CollectionConfiguration(
                config.collection, 
                config.queryFilter, 
                config.actionFilter, 
                config.fields,
                config.preserveArrays || false // Default to false if not present
            )
        );
    }

    public Host: string;
    public Key: string;
    public CollectionsConfiguration: CollectionConfiguration[];
}

export class MeilisearchTaskResult
{
    constructor(success: boolean, message: string)
    {
        this.Success = success;
        this.Message = message;
    }

    public Success: boolean;
    public Message: string;
}
