import { ImageResponse } from "next/og";
import { ENSO_PATH, FLECKS, SEAL_PATH } from "@/components/mark-path";

export const alt = "Shifu: any topic, taught by the best moments on YouTube, and checked until it sticks.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1f1a17";
const MUTED = "#75695e";
const VERMILION = "#c8432b";

/** Fraunces from Google Fonts as a TTF (Satori reads ttf, otf and woff); null falls back to the default face. */
async function loadFraunces(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Fraunces:wght@500", {
        // An old user agent makes Google answer with a truetype source rather than woff2.
        headers: { "User-Agent": "Mozilla/4.0" },
        cache: "force-cache",
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const font = await loadFraunces();
  const serif = font ? "Fraunces" : "serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          background: "radial-gradient(circle at 92% 100%, rgba(200,67,43,0.16) 0%, rgba(200,67,43,0) 55%), #f6f1e8",
        }}
      >
        <div style={{ display: "flex", width: 290, height: 290, flexShrink: 0 }}>
          <svg width="290" height="290" viewBox="0 0 200 200">
            <path d={ENSO_PATH} fill={INK} />
            {FLECKS.map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={INK} />
            ))}
            <path d={SEAL_PATH} fill={VERMILION} fillRule="evenodd" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 60, flex: 1 }}>
          <div style={{ display: "flex", fontFamily: serif, fontSize: 120, lineHeight: 1, color: INK, letterSpacing: -3 }}>Shifu</div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: 36, lineHeight: 1.3, color: INK, marginTop: 24, maxWidth: 600 }}>
            Any topic, taught by the best moments on YouTube, and checked until it sticks.
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 36, whiteSpace: "nowrap" }}>
            Muse Spark 1.3 · Muse Spark Open · Muse Voice Transcribe
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Fraunces", data: font, weight: 500, style: "normal" }] : undefined,
    },
  );
}
