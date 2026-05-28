import { useMemo } from "react";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCardNumber(value) {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export default function usePaymentValidation(checkout, cartCount = 0) {
  const errors = useMemo(() => {
    const nextErrors = {};
    const cardDigits = digitsOnly(checkout.card_number);

    if (!cartCount) {
      nextErrors.cart = "Your cart is empty.";
    }
    if (!String(checkout.contact_name || "").trim()) {
      nextErrors.contact_name = "Contact name is required.";
    }
    if (!String(checkout.contact_phone || "").trim()) {
      nextErrors.contact_phone = "Contact phone is required.";
    }
    if (!String(checkout.shipping_address || "").trim()) {
      nextErrors.shipping_address = "Shipping address is required.";
    }
    if (!String(checkout.payment_method || "").trim()) {
      nextErrors.payment_method = "Select a payment method.";
    }

    if (checkout.payment_method === "card") {
      if (cardDigits.length !== 16) {
        nextErrors.card_number = "Enter a valid 16-digit card number.";
      }
      if (checkout.expiry_date && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(checkout.expiry_date)) {
        nextErrors.expiry_date = "Use MM/YY format.";
      }
      if (checkout.cvv && !/^\d{3,4}$/.test(checkout.cvv)) {
        nextErrors.cvv = "Use a 3 or 4 digit CVV.";
      }
    }

    return nextErrors;
  }, [cartCount, checkout]);

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    canSubmit: cartCount > 0 && Object.keys(errors).length === 0,
    cardDigits: digitsOnly(checkout.card_number),
    formatCardNumber,
  };
}
