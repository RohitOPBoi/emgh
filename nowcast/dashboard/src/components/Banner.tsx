import { AlertOctagon } from "lucide-react";

export function Banner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="banner banner--critical"
      style={{
        position: "absolute",
        top: 66,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        maxWidth: "min(640px, calc(100vw - 32px))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
        <AlertOctagon size={16} style={{ flexShrink: 0 }} />
        <span>{message}</span>
      </div>
    </div>
  );
}
