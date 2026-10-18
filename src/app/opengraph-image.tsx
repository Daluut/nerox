import { ImageResponse } from "next/og";

export const alt = "Nerox: spot a slipping project while there's still time to fix it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card shown when a Nerox link is shared on LinkedIn, Instagram, iMessage and so on. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#070820",
          backgroundImage: "radial-gradient(circle at 85% 10%, rgba(124,92,255,0.45), rgba(7,8,32,0) 60%)",
          color: "#eef0ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path d="M5 19V5l14 14V5" stroke="#8b6dff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="5" cy="5" r="2.3" fill="#eef0ff" />
            <circle cx="5" cy="19" r="2.3" fill="#eef0ff" />
            <circle cx="19" cy="19" r="2.3" fill="#eef0ff" />
            <circle cx="19" cy="5" r="2.7" fill="#4dd8ff" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: 8 }}>NEROX</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5, maxWidth: 980 }}>Spot a slipping project while there&apos;s still time to fix it.</div>
          <div style={{ fontSize: 30, color: "#a9aedd", marginTop: 28 }}>Health scores, What If? simulations and lessons from past projects.</div>
        </div>
        <svg width="1056" height="60" viewBox="0 0 1056 60" fill="none">
          <path d="M0 36 H420 L440 36 L456 8 L476 56 L492 22 L506 36 H1056" stroke="#7c5cff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
