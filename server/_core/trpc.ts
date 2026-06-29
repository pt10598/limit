// server/_core/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { COOKIE_NAME } from '@shared/const';
import { sdk } from './sdk';

// ✅ 建立 Context - 安全處理 Session
export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  let user = null;
  
  try {
    const cookie = req.cookies?.[COOKIE_NAME];
    if (cookie) {
      const payload = sdk.verifySessionToken(cookie);
      if (payload) {
        user = payload;
      }
    }
  } catch (error) {
    // 忽略 Session 驗證錯誤
    console.debug('[Auth] Session 不存在或無效');
  }

  return {
    req,
    res,
    user,
  };
};

// 初始化 tRPC
const t = initTRPC.context<typeof createContext>().create();

// 基本導出
export const router = t.router;
export const middleware = t.middleware;

// ✅ 全域錯誤處理 Middleware
const errorHandler = t.middleware(async ({ ctx, next }) => {
  try {
    return await next({ ctx });
  } catch (error) {
    console.error('[tRPC] 全域錯誤:', error);
    if (error instanceof TRPCError) {
      console.error('[tRPC] 錯誤碼:', error.code);
      console.error('[tRPC] 錯誤訊息:', error.message);
    }
    throw error;
  }
});

// ✅ 公開 Procedure
export const publicProcedure = t.procedure.use(errorHandler);

// ✅ 受保護 Procedure
export const protectedProcedure = t.procedure
  .use(errorHandler)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      console.error('[tRPC] 未登入嘗試訪問受保護資源');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '請先登入',
      });
    }
    return next({ ctx });
  });

// ✅ 管理員 Procedure
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    console.error('[tRPC] 非管理員嘗試訪問管理員資源');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要管理員權限',
    });
  }
  return next({ ctx });
});
