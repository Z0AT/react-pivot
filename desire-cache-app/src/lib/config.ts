import { env } from '$env/dynamic/public';

export function resolveApiBaseUrl() {
	return (env.PUBLIC_DESIRE_CACHE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function buildApiUrl(pathname: string, baseUrl = resolveApiBaseUrl()) {
	return baseUrl ? `${baseUrl}${pathname}` : pathname;
}
