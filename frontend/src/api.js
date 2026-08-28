const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch(path, options = {}, token) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    throw new ApiError(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "Network offline. Please reconnect and retry."
        : "Network request failed",
      0,
      { detail: error?.message || "Network request failed" }
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(payload.detail || "Request failed", response.status, payload);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  login: (body) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  getProducts: (params = {}) => apiFetch(`/products?${new URLSearchParams(compactParams(params)).toString()}`),
  getCategories: () => apiFetch("/products/categories"),
  getProduct: (id) => apiFetch(`/products/${id}`),
  getReviews: (id) => apiFetch(`/products/${id}/reviews`),
  createReview: (id, body, token) => apiFetch(`/products/${id}/reviews`, { method: "POST", body: JSON.stringify(body) }, token),
  getBanners: () => apiFetch("/search/banners"),
  searchProducts: (params = {}) => apiFetch(`/search?${new URLSearchParams(compactParams(params)).toString()}`),
  getHotSearches: (q = "") => apiFetch(`/search/hot-trends${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  trending: () => apiFetch("/api/recommendations/trending"),
  personalized: (token) => apiFetch("/api/recommendations/personalized", {}, token),
  similar: (productId) => apiFetch(`/api/recommendations/similar/${productId}`),
  boughtTogether: (productId) => apiFetch(`/api/recommendations/frequently-bought-together/${productId}`),
  explainRecommendation: (productId, token) => apiFetch(`/api/recommendations/explain/${productId}`, {}, token),
  checkout: (body, token) => apiFetch("/orders/checkout", { method: "POST", body: JSON.stringify(body) }, token),
  orderHistory: (token) => apiFetch("/orders/history", {}, token),
  adminOrders: (params = {}, token) => apiFetch(`/orders?${new URLSearchParams(compactParams(params)).toString()}`, {}, token),
  profile: (token) => apiFetch("/profile", {}, token),
  browsingHistory: (token) => apiFetch("/profile/browsing-history", {}, token),
  wishlist: (token) => apiFetch("/profile/wishlist", {}, token),
  createAddress: (body, token) => apiFetch("/profile/addresses", { method: "POST", body: JSON.stringify(body) }, token),
  updateAddress: (id, body, token) => apiFetch(`/profile/addresses/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteAddress: (id, token) => apiFetch(`/profile/addresses/${id}`, { method: "DELETE" }, token),
  dashboard: (token) => apiFetch("/analytics/dashboard", {}, token),
  businessInsights: (token) => apiFetch("/analytics/insights", {}, token),
  warRoom: async (token) => {
    try {
      return await apiFetch("/analytics/war-room", {}, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return apiFetch("/analytics/dashboard/war-room", {}, token);
      }
      throw error;
    }
  },
  categoryPerformance: (token) => apiFetch("/analytics/category-performance", {}, token),
  geography: (token) => apiFetch("/analytics/geography", {}, token),
  rfm: (token) => apiFetch("/analytics/rfm", {}, token),
  cohorts: (token) => apiFetch("/analytics/cohorts", {}, token),
  forecast: (token, days = 7) => apiFetch(`/analytics/forecast?days=${days}`, {}, token),
  stockouts: (token) => apiFetch("/analytics/stockout-predictions", {}, token),
  funnel: (token) => apiFetch("/analytics/funnel", {}, token),
  logs: (token) => apiFetch("/analytics/logs", {}, token),
  inventoryAlerts: (token) => apiFetch("/analytics/inventory-alerts", {}, token),
  churn: (token) => apiFetch("/analytics/churn-predictions", {}, token),
  metrics: (token) => apiFetch("/analytics/recommendation-metrics", {}, token),
  adminSummary: (token) => apiFetch("/admin/summary", {}, token),
  salesAccounts: (token) => apiFetch("/admin/sales-accounts", {}, token),
  adminUsers: (token) => apiFetch("/admin/users", {}, token),
  adminUserDetail: (id, token) => apiFetch(`/admin/users/${id}`, {}, token),
  suspicious: (token) => apiFetch("/admin/suspicious-activities", {}, token),
  createCategory: (body, token) => apiFetch("/products/categories", { method: "POST", body: JSON.stringify(body) }, token),
  createProduct: (body, token) => apiFetch("/products", { method: "POST", body: JSON.stringify(body) }, token),
  updateProduct: (id, body, token) => apiFetch(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  browseProduct: (id, dwellSeconds = 45, token) =>
    apiFetch(`/products/${id}/browse?dwell_seconds=${dwellSeconds}`, { method: "POST" }, token),
};

function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

export { API_BASE };
