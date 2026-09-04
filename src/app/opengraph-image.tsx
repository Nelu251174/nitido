import { ImageResponse } from "next/og";

// Imaginea care apare la share pe WhatsApp / Facebook / LinkedIn. Fără ea,
// link-urile Nitido apăreau fără thumbnail. Generată dinamic, în brandul Nitido.
// Notă: next/og (Satori) cere display:flex explicit pe orice element cu mai
// mulți copii — de aceea fiecare container e flex.
export const alt = "Nitido — Marketplace de curățenie în România";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f1e27 0%, #142530 60%, #0e3b39 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 800 }}>
          <span style={{ color: "white" }}>Nit</span>
          <span style={{ color: "#17b8a6" }}>ido</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, maxWidth: 940 }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, color: "white", lineHeight: 1.15 }}>
            Postezi lucrarea.
          </div>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.15 }}>
            <span style={{ color: "#17b8a6" }}>Prima firmă</span>
            <span style={{ color: "white", marginLeft: 16 }}>care acceptă o ia.</span>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 36, fontSize: 30, color: "rgba(255,255,255,0.65)" }}>
          Marketplace de curățenie · România · Preț fix, plată securizată
        </div>
      </div>
    ),
    { ...size }
  );
}
