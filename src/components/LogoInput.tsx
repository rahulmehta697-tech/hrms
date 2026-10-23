"use client";
import { useState } from "react";

/** Reads a logo file, keeps the original for the web page and a 256 px PNG for PDF headers. */
export default function LogoInput({ current }: { current: string | null }) {
  const [src, setSrc] = useState<string | null>(current);
  const [png, setPng] = useState("");
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  function pick(f?: File) {
    setErr("");
    if (!f) return;
    if (f.size > 500_000) { setErr("That file is over 500 KB. Use a smaller logo."); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result);
      setRaw(url); setSrc(url);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = 256;
        const x = c.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, 256, 256);
        const s = Math.min(256 / (img.width || 256), 256 / (img.height || 256));
        x.drawImage(img, (256 - img.width * s) / 2, (256 - img.height * s) / 2, img.width * s, img.height * s);
        setPng(c.toDataURL("image/png"));
      };
      img.src = url;
    };
    rd.readAsDataURL(f);
  }
  return (
    <div className="row" style={{ gap: 14 }}>
      <div className="logo-box">{src ? <img src={src} alt="Institute logo" /> : "No logo"}</div>
      <div className="fld" style={{ flex: "1 1 240px" }}>
        <label htmlFor="logofile">Upload logo</label>
        <input id="logofile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
        <span className="hint">PNG or SVG on a white or transparent background works best. Square, at least 256 px, under 500 KB. Press Save to keep it.</span>
        {err && <span className="msg err">{err}</span>}
        <input type="hidden" name="logo" value={raw} /><input type="hidden" name="logoPng" value={png} />
      </div>
    </div>
  );
}
