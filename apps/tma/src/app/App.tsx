import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { useAuthBootstrap } from '../hooks/useApi';
import { ApiClientError } from '../lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // خطاهای احراز هویت و اشتراک را دوباره تلاش نکن
        if (error instanceof ApiClientError) {
          if (error.isAuthError || error.needsSubscription) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Auth bootstrap باید داخل QueryClientProvider اجرا شود */
function Bootstrap() {
  useAuthBootstrap();
  return <AppShell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Bootstrap />
    </QueryClientProvider>
  );
}
