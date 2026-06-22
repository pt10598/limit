import { useEffect } from "react";

const LINE_ID = "dk886dk";
const LINE_URL = `https://line.me/ti/p/~${LINE_ID}`;
const QR_URL = "data:image/png;base64,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";

export default function ServicePage() {
  useEffect(() => {
    document.title = "聯繫客服 | 極限貸";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-start px-4 py-10">
      {/* 頂部標籤 */}
      <div className="mb-6 px-5 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium flex items-center gap-1.5">
        <span>✨</span>
        <span>免費初步評估・不影響聯徵</span>
      </div>

      {/* 主標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
          資金安排想更靈活？
        </h1>
        <p className="text-gray-500 text-base">
          線上快速諮詢・專人一對一服務
        </p>
      </div>

      {/* 特色列表 */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-8 space-y-4">
        {[
          "流程簡單・3步驟了解方案",
          "LINE 即時回覆・不用跑銀行",
          "免費初步評估・無壓力諮詢",
        ].map((text) => (
          <div key={text} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-gray-800 text-base font-medium">{text}</span>
          </div>
        ))}
      </div>

      {/* LINE 加入按鈕 */}
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-sm mb-8 flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.97] text-white text-lg font-bold py-4 rounded-full shadow-lg transition-all duration-150"
        style={{ boxShadow: "0 4px 20px rgba(6,199,85,0.35)" }}
      >
        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        點擊加入 LINE 諮詢
      </a>

      {/* QR Code */}
      <div className="w-full max-w-sm flex flex-col items-center mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
          <img
            src={QR_URL}
            alt="LINE QR Code"
            className="w-52 h-52 object-contain"

          />
        </div>

        {/* LINE ID 顯示 */}
        <div className="bg-gray-100 rounded-xl px-6 py-3 mb-4">
          <span className="font-mono font-bold text-gray-800 text-base tracking-widest">
            LINE ID : {LINE_ID}
          </span>
        </div>

        {/* 提示文字 */}
        <p className="text-gray-500 text-sm flex items-center gap-1.5">
          <span>👆</span>
          長按識別 QR Code 或 點擊上方按鈕
        </p>
      </div>

      {/* 底部返回首頁 */}
      <a
        href="/"
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2"
      >
        ← 返回首頁
      </a>
    </div>
  );
}
