import { useEffect } from "react";
import { AlertTriangle, QrCode, Smartphone } from "lucide-react";

export default function PaymentModal({ open, method, loading, error, onClose, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [loading, onClose, open]);

  if (!open) return null;

  const appLabel = method === "alipay" ? "Open App to Pay" : "跳转应用支付";
  const methodLabel = method === "alipay" ? "Alipay" : "WeChat Pay";

  return (
    <div className="payment-modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="payment-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-to-pay-title"
      >
        <div className="section-title">
          <div>
            <p className="eyebrow">Mock Gateway</p>
            <h3 id="scan-to-pay-title">Scan to Pay</h3>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} disabled={loading}>Close</button>
        </div>

        <div className="payment-qr-box">
          <QrCode size={72} strokeWidth={1.6} />
          <strong>{methodLabel}</strong>
          <span>支付二维码</span>
        </div>

        <p className="payment-helper-copy">
          This is a mock QR flow for the course demo. No real QR code or app deep link is generated.
        </p>

        {error ? (
          <div className="payment-inline-error payment-inline-error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <button type="button" onClick={onConfirm} disabled={loading} className="payment-primary-button">
          <Smartphone size={18} />
          <span>{loading ? "Processing..." : appLabel}</span>
        </button>
      </div>
    </div>
  );
}
