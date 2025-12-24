import { flatten } from "flat";
import { stripHtml } from "string-strip-html";
import { MeiliSearch, type EnqueuedTask } from "meilisearch";
import { MeilisearchTaskResult } from "./models";

const flattenAndStripHtml = (object: any, preserveArrays: boolean = false): any => {
    // If preserveArrays is true, we use a custom flattening strategy that keeps arrays intact.
    if (preserveArrays) {
        return processStripping(flattenWithArrays(object));
    }

    // Default flattening (everything becomes dot-notation keys)
    const flattenedObject = flatten(object) as any;
    return processStripping(flattenedObject);
};

// Helper to strip HTML and remove unwanted keys
const processStripping = (flattenedObject: any) => {
    for (const key of Object.keys(flattenedObject)) {
        // Delete unwanted properties (blocks, nodes, etc. unless specific fields)
        if ((key.includes("blocks") || key.includes("nodes") || key.includes("content")) &&
            !(key.endsWith(".title") || key.endsWith(".content") || key.endsWith(".text") || key.endsWith(".caption") || key.endsWith(".description") || key.endsWith(".summary"))) {
            delete flattenedObject[key];
            continue;
        }

        if (flattenedObject[key] == null) {
            delete flattenedObject[key];
            continue;
        }

        // Strip HTML from string fields that likely contain it
        if (typeof flattenedObject[key] === 'string' &&
            (key.endsWith("content") || key.endsWith("description") || key.endsWith("text") || key.endsWith("summary") || key.endsWith("caption"))) {
            flattenedObject[key] = stripHtml(flattenedObject[key]).result;
        }
    }
    return flattenedObject;
};

// Custom flattener that preserves arrays
const flattenWithArrays = (obj: any, prefix = '', res: any = {}) => {
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const val = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(val)) {
            // Preserve the array as is
            res[newKey] = val;
        } else if (typeof val === 'object' && val !== null) {
            // Recurse for objects
            flattenWithArrays(val, newKey, res);
        } else {
            // Primitive values
            res[newKey] = val;
        }
    }
    return res;
};

const waitForMeilisearchTask = async (client: MeiliSearch, task: EnqueuedTask) => {
    try {
        const result = await client.tasks.waitForTask(task.taskUid, { timeout: 10000 });
        if (result.status === "failed") {
            return new MeilisearchTaskResult(false, result.error?.message || "Task failed");
        }
        return new MeilisearchTaskResult(true, "");
    } catch (e: any) {
        return new MeilisearchTaskResult(false, e.message || "Task wait error");
    }
};

export { flattenAndStripHtml, waitForMeilisearchTask };
