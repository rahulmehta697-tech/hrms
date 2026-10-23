import { PRODUCT } from "@/lib/product";

export default function Powered({ center }: { center?: boolean }) {
  return (
    <p className="hint" style={{ margin: 0, textAlign: center ? "center" : undefined }}>
      Powered by {PRODUCT.url ? <a href={PRODUCT.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", fontWeight: 600 }}>{PRODUCT.name}</a> : <b>{PRODUCT.name}</b>}
      {PRODUCT.support && <> · Support: <span style={{ userSelect: "all" }}>{PRODUCT.support}</span></>}
    </p>
  );
}
