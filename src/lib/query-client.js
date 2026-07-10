import { QueryClient } from '@tanstack/react-query';

// Don't retry on 401/403 — auth failures aren't transient; retrying floods /User/me
function shouldRetry(failureCount, error) {
  const status = error?.status || error?.response?.status;
  if (status === 401 || status === 403) return false;
  return failureCount < 1;
}

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			retry: shouldRetry,
			staleTime: 5 * 60_000, // 5 min — homepage data stays fresh across navigation
			gcTime: 10 * 60_000,   // 10 min — keep in cache after unmount
		},
	},
});