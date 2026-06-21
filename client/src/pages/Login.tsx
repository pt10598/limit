import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Zap, Phone, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Mode = "login" | "register";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("登入成功！");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "登入失敗，請再試一次");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("註冊成功！歡迎加入極限貸");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "註冊失敗，請再試一次");
    },
  });

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error("請填寫手機號碼和密碼");
      return;
    }
    if (!/^09\d{8}$/.test(phone)) {
      toast.error("請輸入正確的手機號碼（09 開頭，共 10 碼）");
      return;
    }
    if (mode === "login") {
      loginMutation.mutate({ phone, password, isAdmin: false });
    } else {
      if (password.length < 6) {
        toast.error("密碼至少需要 6 個字元");
        return;
      }
      registerMutation.mutate({ phone, password, name: name || undefined });
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center px-5 pt-6 pb-4 bg-white border-b border-gray-100 shadow-sm">
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#1a2744] font-bold text-lg tracking-wide">極限貸</span>
        </div>
      </div>

      {/* Header */}
      <div className="px-6 mt-6 mb-6">
        <h1 className="text-[#1a2744] text-2xl font-bold mb-1">
          {mode === "login" ? "歡迎回來" : "建立帳號"}
        </h1>
        <p className="text-gray-500 text-sm">
          {mode === "login" ? "登入以繼續使用借貸服務" : "註冊成為極限貸會員"}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mx-5 mb-6">
        <div className="bg-gray-100 rounded-xl p-1 flex">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "login"
                ? "bg-white text-[#FF6B35] shadow"
                : "text-gray-500"
            }`}
          >
            登入
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "register"
                ? "bg-white text-[#FF6B35] shadow"
                : "text-gray-500"
            }`}
          >
            註冊
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-5 space-y-4">
        {mode === "register" && (
          <div>
            <label className="text-gray-600 text-xs mb-1.5 block">姓名（選填）</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入您的姓名"
                className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-10 pr-4 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all shadow-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-gray-600 text-xs mb-1.5 block">手機號碼</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="例：0912345678"
              className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-10 pr-4 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all shadow-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-gray-600 text-xs mb-1.5 block">
            密碼{mode === "register" && "（至少 6 個字元）"}
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "設定密碼（至少 6 碼）" : "請輸入密碼"}
              className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-10 pr-12 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all shadow-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-2xl bg-[#FF6B35] text-white font-bold text-base shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#e85a24]"
          >
            {isLoading
              ? (mode === "login" ? "登入中..." : "註冊中...")
              : (mode === "login" ? "登入" : "立即註冊")}
          </button>
        </div>
      </form>

      {/* Footer note */}
      <div className="mx-5 mt-6">
        <p className="text-gray-400 text-xs text-center leading-relaxed">
          {mode === "register"
            ? "註冊即表示您同意極限貸的服務條款與隱私政策"
            : <>忘記密碼？請<Link href="/service" className="text-[#FF6B35] underline underline-offset-2 hover:text-[#e85a24] transition-colors">聯繫客服</Link>協助重設</>}
        </p>
      </div>

      {/* Security badge */}
      <div className="mx-5 mt-4 bg-white rounded-xl p-3 flex items-center gap-2.5 border border-gray-100 shadow-sm">
        <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <span className="text-green-500 text-sm">🔒</span>
        </div>
        <div>
          <p className="text-gray-700 text-xs font-medium">安全加密保護</p>
          <p className="text-gray-400 text-xs">您的個人資料受到 SSL 加密保護</p>
        </div>
      </div>

      <div className="flex-1 min-h-8" />
    </div>
  );
}
