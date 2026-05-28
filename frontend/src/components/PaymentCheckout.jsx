import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, LoaderCircle, MapPinned, Smartphone } from "lucide-react";
import PaymentModal from "./PaymentModal";
import usePaymentValidation from "../hooks/usePaymentValidation";

function simulatePaymentGateway() {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (Math.random() < 0.05) {
        reject(new Error("Payment failed, please try again"));
        return;
      }
      resolve({ status: "success", reference: `MOCK-${Date.now()}` });
    }, 1100);
  });
}

export default function PaymentCheckout({ cart, checkout, setCheckout, submitting, onSubmitOrder }) {
  const [touched, setTouched] = useState({});
  const [gatewayError, setGatewayError] = useState("");
  const [isGatewayLoading, setIsGatewayLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [cart]);
  const { errors, canSubmit, formatCardNumber } = usePaymentValidation(checkout, cart.length);

  useEffect(() => {
    if (checkout.payment_method === "alipay" || checkout.payment_method === "wechat") {
      setIsQrModalOpen(true);
    } else {
      setIsQrModalOpen(false);
    }
  }, [checkout.payment_method]);

  function updateField(field, value) {
    setCheckout((current) => ({ ...current, [field]: value }));
    setGatewayError("");
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function showError(field) {
    return touched[field] && errors[field] ? errors[field] : "";
  }

  async function finalizeOrder() {
    const payload = {
      shipping_address: checkout.shipping_address,
      payment_method: checkout.payment_method,
      coupon_code: checkout.coupon_code,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        variant_id: item.variant_id,
      })),
    };
    await onSubmitOrder(payload);
  }

  async function handleCardSubmit(event) {
    event.preventDefault();
    setTouched({
      contact_name: true,
      contact_phone: true,
      shipping_address: true,
      payment_method: true,
      card_number: true,
      expiry_date: true,
      cvv: true,
      cardholder_name: true,
    });
    if (!canSubmit) return;

    setGatewayError("");
    setIsGatewayLoading(true);
    try {
      // Mock payment authorization for the card flow.
      await simulatePaymentGateway();
      await finalizeOrder();
    } catch (error) {
      setGatewayError(error.message || "Payment failed, please try again");
    } finally {
      setIsGatewayLoading(false);
    }
  }

  async function handleQrConfirm() {
    setTouched({
      contact_name: true,
      contact_phone: true,
      shipping_address: true,
      payment_method: true,
    });
    if (!canSubmit) {
      setGatewayError("Complete the required shipping and contact fields before payment.");
      return;
    }

    setGatewayError("");
    setIsGatewayLoading(true);
    try {
      // Mock a QR scan success/failure without leaving the app.
      await simulatePaymentGateway();
      setIsQrModalOpen(false);
      await finalizeOrder();
    } catch (error) {
      setGatewayError(error.message || "Payment failed, please try again");
    } finally {
      setIsGatewayLoading(false);
    }
  }

  const busy = submitting || isGatewayLoading;

  return (
    <>
      <form className="panel payment-checkout-panel" onSubmit={handleCardSubmit}>
        <div className="section-title">
          <div>
            <h3>Payment Checkout</h3>
            <span>Secure mock payment flow for the course demo</span>
          </div>
          <strong>{`CNY ${total.toFixed(2)}`}</strong>
        </div>

        {gatewayError ? (
          <div className="payment-inline-error payment-inline-error-banner">
            <AlertTriangle size={16} />
            <span>{gatewayError}</span>
          </div>
        ) : null}

        <div className="payment-form-grid">
          <label className="payment-field">
            <span>Contact Name</span>
            <input
              value={checkout.contact_name}
              onChange={(event) => updateField("contact_name", event.target.value)}
              onBlur={() => markTouched("contact_name")}
              placeholder="Receiver full name"
            />
            {showError("contact_name") ? <small className="payment-inline-error">{showError("contact_name")}</small> : null}
          </label>

          <label className="payment-field">
            <span>Contact Phone</span>
            <input
              value={checkout.contact_phone}
              onChange={(event) => updateField("contact_phone", event.target.value)}
              onBlur={() => markTouched("contact_phone")}
              placeholder="Mobile phone"
            />
            {showError("contact_phone") ? <small className="payment-inline-error">{showError("contact_phone")}</small> : null}
          </label>
        </div>

        <label className="payment-field">
          <span>Shipping Address</span>
          <textarea
            value={checkout.shipping_address}
            onChange={(event) => updateField("shipping_address", event.target.value)}
            onBlur={() => markTouched("shipping_address")}
            placeholder="Street, building, district, city"
          />
          {showError("shipping_address") ? <small className="payment-inline-error">{showError("shipping_address")}</small> : null}
        </label>

        <label className="payment-field">
          <span>Coupon Code</span>
          <input
            value={checkout.coupon_code}
            onChange={(event) => updateField("coupon_code", event.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="payment-method-group">
          <button
            type="button"
            className={checkout.payment_method === "card" ? "payment-method-card active" : "payment-method-card"}
            onClick={() => updateField("payment_method", "card")}
          >
            <CreditCard size={18} />
            <div>
              <strong>Credit / Debit Card</strong>
              <span>Enter card number to enable Pay Now</span>
            </div>
          </button>

          <button
            type="button"
            className={checkout.payment_method === "alipay" ? "payment-method-card active" : "payment-method-card"}
            onClick={() => updateField("payment_method", "alipay")}
          >
            <Smartphone size={18} />
            <div>
              <strong>Alipay</strong>
              <span>Mock QR code flow</span>
            </div>
          </button>

          <button
            type="button"
            className={checkout.payment_method === "wechat" ? "payment-method-card active" : "payment-method-card"}
            onClick={() => updateField("payment_method", "wechat")}
          >
            <MapPinned size={18} />
            <div>
              <strong>WeChat Pay</strong>
              <span>Mock QR code flow</span>
            </div>
          </button>
        </div>

        {showError("payment_method") ? <small className="payment-inline-error">{showError("payment_method")}</small> : null}

        {checkout.payment_method === "card" ? (
          <div className="payment-card-form">
            <label className="payment-field">
              <span>Card Number</span>
              <input
                value={formatCardNumber(checkout.card_number)}
                onChange={(event) => updateField("card_number", formatCardNumber(event.target.value))}
                onBlur={() => markTouched("card_number")}
                inputMode="numeric"
                maxLength={19}
                placeholder="1234 5678 9012 3456"
              />
              {showError("card_number") ? <small className="payment-inline-error">{showError("card_number")}</small> : null}
            </label>

            <div className="payment-form-grid">
              <label className="payment-field">
                <span>Expiry Date</span>
                <input
                  value={checkout.expiry_date}
                  onChange={(event) => updateField("expiry_date", event.target.value)}
                  onBlur={() => markTouched("expiry_date")}
                  maxLength={5}
                  placeholder="MM/YY"
                />
                {showError("expiry_date") ? <small className="payment-inline-error">{showError("expiry_date")}</small> : null}
              </label>

              <label className="payment-field">
                <span>CVV</span>
                <input
                  value={checkout.cvv}
                  onChange={(event) => updateField("cvv", event.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => markTouched("cvv")}
                  inputMode="numeric"
                  placeholder="123"
                />
                {showError("cvv") ? <small className="payment-inline-error">{showError("cvv")}</small> : null}
              </label>
            </div>

            <label className="payment-field">
              <span>Cardholder Name</span>
              <input
                value={checkout.cardholder_name}
                onChange={(event) => updateField("cardholder_name", event.target.value)}
                onBlur={() => markTouched("cardholder_name")}
                placeholder="Name on card"
              />
            </label>
          </div>
        ) : null}

        {(checkout.payment_method === "alipay" || checkout.payment_method === "wechat") ? (
          <div className="payment-qr-hint">
            <CheckCircle2 size={18} />
            <span>The scan modal opens automatically for QR-based payment methods.</span>
            <button type="button" className="ghost-button" onClick={() => setIsQrModalOpen(true)}>
              Reopen QR
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          className="payment-primary-button"
          disabled={!canSubmit || checkout.payment_method !== "card" || busy}
        >
          {busy ? <LoaderCircle size={18} className="spin" /> : <CheckCircle2 size={18} />}
          <span>{busy ? "Processing Payment..." : "Pay Now"}</span>
        </button>
      </form>

      <PaymentModal
        open={isQrModalOpen}
        method={checkout.payment_method}
        loading={busy}
        error={gatewayError}
        onClose={() => setIsQrModalOpen(false)}
        onConfirm={handleQrConfirm}
      />
    </>
  );
}
