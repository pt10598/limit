import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";

function FullScreenImage() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      <img
        src="/manus-storage/4491885_1_1_90b64890.jpg"
        alt="Blocked"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <FullScreenImage />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
