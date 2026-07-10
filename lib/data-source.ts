import "server-only";

import { unstable_cache } from "next/cache";
import {
	analyticsCacheSeconds,
	analyticsCacheTag,
	hasBlobConfiguration,
	loadActiveBlobSnapshot,
	loadBundledSnapshot,
	type AnalyticsSnapshot,
} from "@/lib/blob-store";

const loadCachedBlobSnapshot = unstable_cache(
	loadActiveBlobSnapshot,
	["active-analytics-blob-snapshot"],
	{ revalidate: analyticsCacheSeconds, tags: [analyticsCacheTag] },
);

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
	if (hasBlobConfiguration()) {
		const blobSnapshot = await loadCachedBlobSnapshot();
		if (blobSnapshot) return blobSnapshot;
	}
	return loadBundledSnapshot();
}
