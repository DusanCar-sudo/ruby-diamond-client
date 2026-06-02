import { useEffect } from "react";

interface Props {
  onDismiss: () => void;
}

export function Splash({ onDismiss }: Props) {
  useEffect(() => {
    // Auto-dismiss after 10 seconds
    const timer = setTimeout(onDismiss, 10000);

    // Dismiss on Enter key
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        clearTimeout(timer);
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onDismiss]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#0A0A0D",
      overflow: "hidden",
    }}>
      {/* Background image with fade effect */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(/splash-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.85,
        filter: "brightness(0.6) saturate(1.2)",
      }} />

      {/* Gradient overlays */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
        background: "linear-gradient(to top, #0A0A0D, transparent)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1,
        textAlign: "center",
        animation: "fadeInUp 1s ease-out",
      }}>
        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "var(--accent, #A0522D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 0 60px rgba(160, 82, 45, 0.4), 0 0 120px rgba(160, 82, 45, 0.2)",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="#FDF6E3" stroke="#C17F59" strokeWidth="0.8"/>
            <path d="M12 2v20M3 7l9 5 9-5" stroke="#FDF6E3" strokeWidth="0.3" opacity="0.5"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 42, fontWeight: 700,
          letterSpacing: "-1px",
          color: "#FDF6E3",
          marginBottom: 8,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
        }}>
          Ruby Diamond
        </h1>

        <p style={{
          fontSize: 14, fontWeight: 300,
          letterSpacing: "4px", textTransform: "uppercase",
          color: "#C17F59",
          marginBottom: 32,
        }}>
          Precision AI Harnesses
        </p>

        {/* Progress bar */}
        <div style={{
          width: 200, height: 2,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 1, margin: "0 auto 16px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: "100%",
            background: "var(--accent, #A0522D)",
            borderRadius: 1,
            animation: "shrinkBar 10s linear forwards",
          }} />
        </div>

        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.4)",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Press <span style={{ color: "#C17F59", fontWeight: 600 }}>ENTER</span> to continue
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
