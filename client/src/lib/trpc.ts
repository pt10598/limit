// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/routers';

// ✅ 建立 tRPC React 客戶端
export const api = createTRPCReact<AppRouter>();

// ✅ 取得 API 基礎 URL
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // 瀏覽器端：使用相對路徑
    return '';
  }
  // 伺服器端：使用環境變數
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.RENDER_URL) {
    return process.env.RENDER_URL;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// ✅ 建立 tRPC 客戶端
export const trpcClient = api.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      // ✅ 移除多餘的 headers，tRPC 會自動處理
      // 如果需要自訂 headers，可以在這裡加入
      // headers: {
      //   // 自訂 headers
      // },
    }),
  ],
});

// ✅ 包裝用的 Provider
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}

// 需要額外 import
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
