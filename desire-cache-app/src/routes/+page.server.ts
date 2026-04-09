import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildApiUrl, resolveApiBaseUrl } from '$lib/config';
import type { DesireCachePayload } from '$lib/types/desire-cache';

export const load: PageServerLoad = async ({ fetch }) => {
	const apiBaseUrl = resolveApiBaseUrl();
	const apiItemsUrl = buildApiUrl('/api/items', apiBaseUrl);

	try {
		const response = await fetch(apiItemsUrl);
		if (!response.ok) {
			throw kitError(response.status, `Canonical feed request failed with status ${response.status}`);
		}

		const payload = (await response.json()) as DesireCachePayload;

		return {
			payload,
			apiBaseUrl,
			apiItemsUrl,
			error: null
		};
	} catch (err) {
		return {
			payload: null,
			apiBaseUrl,
			apiItemsUrl,
			error: err instanceof Error ? err.message : 'Unknown Desire Cache API failure'
		};
	}
};
