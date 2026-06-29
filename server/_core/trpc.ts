// _core/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { COOKIE_NAME } from '@shared/const';
import { sdk } from './sdk';

// ✅ 建立 Context - 安全處理 Session，不拋出錯誤
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
    // 忽略 Session 驗證錯誤，讓 user 保持 null
    console.debug('[Auth] Session not present or invalid');
  }

  return {
    req,
    res,
    user, // 可能是 null 或使用者資料
  };
};

// 初始化 tRPC
const t = initTRPC.context<typeof createContext>().create();

// 基本導出
export const router = t.router;
export const middleware = t.middleware;

// ✅ 公開 Procedure - 所有人都可以訪問
export const publicProcedure = t.procedure;

// ✅ 受保護的 Procedure - 需要登入
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED', 
      message: '請先登入' 
    });
  }
  return next({ 
    ctx: {
      ...ctx,
      user: ctx.user, // 確保 user 存在
    }
  });
});

// ✅ 管理員 Procedure - 需要登入且是管理員
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN', 
      message: '需要管理員權限' 
    });
  }
  return next({ ctx });
});
