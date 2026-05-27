import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, HeatmapChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import * as echarts from "echarts/core";
import { ApiError, api } from "./api";

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
]);

const RANGE_OPTIONS = [
  { label: "Today", value: "today", forecastDays: 7 },
  { label: "7D", value: "7d", forecastDays: 7 },
  { label: "30D", value: "30d", forecastDays: 30 },
];

const DEFAULT_LOGIN = { username: "customer_test", password: "password" };
const DEFAULT_REGISTER = { username: "", email: "", password: "" };
const DEFAULT_PRODUCT_FORM = {
  category_id: "",
  name: "",
  brand: "",
  description: "",
  price: "",
  stock_quantity: "",
  image_url: "",
  tags: "trending,new-arrival",
  variants: [{ sku: "", color: "", size: "", stock_quantity: "", image_url: "" }],
};

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname || "/");
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("sca-auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [toast, setToast] = useState(null);
  const [range, setRange] = useState("today");
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [publicData, setPublicData] = useState({
    banners: [],
    categories: [],
    homepageProducts: [],
    trending: [],
    personalized: [],
  });
  const [searchState, setSearchState] = useState({
    q: "",
    category_id: "",
    min_price: "",
    max_price: "",
    min_rating: "",
    brand: "",
    sort: "relevance",
    page: 1,
    results: [],
    total: 0,
    suggestions: [],
  });
  const [productState, setProductState] = useState({
    detail: null,
    reviews: [],
    boughtTogether: [],
    similar: [],
    selectedVariantId: null,
    selectedImageUrl: null,
  });
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState({ shipping_address: "", payment_method: "card", coupon_code: "" });
  const [profileData, setProfileData] = useState({
    profile: null,
    browsing: [],
    wishlist: [],
    orders: [],
    couponTab: "active",
    addressDraft: {
      contact_name: "",
      phone: "",
      province: "",
      city: "",
      district: "",
      address_line: "",
      postal_code: "",
      is_default: false,
    },
    orderModal: null,
  });
  const [adminData, setAdminData] = useState({
    summary: null,
    dashboard: null,
    warRoom: null,
    categoryPerformance: [],
    geography: [],
    rfm: [],
    cohorts: [],
    forecast: [],
    orders: [],
    stockouts: [],
    adminUsers: [],
    selectedUser: null,
    suspicious: [],
    funnel: [],
    logs: [],
    inventoryAlerts: [],
    salesAccounts: [],
  });
  const [productForm, setProductForm] = useState(DEFAULT_PRODUCT_FORM);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", parent_id: "" });
  const [productPageProducts, setProductPageProducts] = useState([]);

  const isCustomer = auth?.user?.role === "customer";
  const isStaff = auth?.user?.role === "sales" || auth?.user?.role === "admin";
  const isAdmin = auth?.user?.role === "admin";

  const topCategories = useMemo(
    () => publicData.categories.filter((item) => item.level === 1).slice(0, 8),
    [publicData.categories]
  );

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (auth) {
      localStorage.setItem("sca-auth", JSON.stringify(auth));
    } else {
      localStorage.removeItem("sca-auth");
    }
  }, [auth]);

  useEffect(() => {
    void loadPublicShell();
  }, [auth]);

  useEffect(() => {
    if (route === "/search") {
      void loadSearchResults();
    }
    if (route === "/" && isCustomer) {
      void loadPersonalized();
    }
    if (route === "/profile" && isCustomer) {
      void loadProfileView();
    }
    if (route === "/dashboard" && isStaff) {
      void loadDashboardData(true);
    }
    if (route.startsWith("/admin") && isStaff) {
      void loadAdminView();
    }
    if (route.startsWith("/product/")) {
      const productId = Number(route.split("/")[2]);
      if (productId) void loadProduct(productId);
    }
  }, [route, auth, range]);

  useEffect(() => {
    if (route === "/search") {
      void loadSearchResults();
    }
  }, [searchState.page]);

  useEffect(() => {
    if (route !== "/dashboard" || !isStaff) return undefined;
    const timer = setInterval(() => {
      void loadDashboardData(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [route, isStaff, range]);

  useEffect(() => {
    if (route !== "/search") return undefined;
    const timer = setTimeout(() => {
      void loadHotSearches(searchState.q);
    }, 200);
    return () => clearTimeout(timer);
  }, [route, searchState.q]);

  function navigate(nextPath) {
    if (nextPath === route) return;
    window.history.pushState({}, "", nextPath);
    setRoute(nextPath);
  }

  function showError(error) {
    if (error instanceof ApiError && error.status === 429) {
      setToast({ type: "warning", message: "Too many requests, please slow down." });
      return;
    }
    setToast({ type: "error", message: error.message || "Request failed" });
  }

  function messageFromError(error) {
    if (error instanceof ApiError) {
      return error.payload?.detail || error.message || "Request failed";
    }
    return error?.message || "Request failed";
  }

  async function withLoading(key, task) {
    setLoading((current) => ({ ...current, [key]: true }));
    try {
      await task();
    } catch (error) {
      showError(error);
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function loadPublicShell() {
    await withLoading("public", async () => {
      const [banners, categories, homepageProducts, trending] = await Promise.all([
        api.getBanners(),
        api.getCategories(),
        api.getProducts({ sort_by: "updated_at" }),
        api.trending(),
      ]);
      const personalized = auth && isCustomer ? await api.personalized(auth.access_token) : [];
      setPublicData({ banners, categories, homepageProducts, trending, personalized });
      setProductPageProducts(homepageProducts);
    });
  }

  async function loadPersonalized() {
    if (!auth || !isCustomer) return;
    await withLoading("personalized", async () => {
      const personalized = await api.personalized(auth.access_token);
      setPublicData((current) => ({ ...current, personalized }));
    });
  }

  async function loadSearchResults() {
    await withLoading("search", async () => {
      const response = await api.searchProducts({
        q: searchState.q,
        category_id: searchState.category_id,
        min_price: searchState.min_price,
        max_price: searchState.max_price,
        min_rating: searchState.min_rating,
        brand: searchState.brand,
        sort: searchState.sort,
        page: searchState.page,
        page_size: 12,
      });
      setSearchState((current) => ({
        ...current,
        results: response.items,
        total: response.total,
      }));
    });
  }

  async function loadHotSearches(query) {
    await withLoading("hot-searches", async () => {
      const suggestions = await api.getHotSearches(query);
      setSearchState((current) => ({ ...current, suggestions }));
    });
  }

  async function loadProduct(productId) {
    await withLoading("product", async () => {
      const tasks = [
        api.getProduct(productId),
        api.getReviews(productId),
        api.boughtTogether(productId),
        api.similar(productId),
      ];
      if (auth && isCustomer) {
        tasks.push(api.browseProduct(productId, 52, auth.access_token));
      }
      const [detail, reviews, boughtTogether, similar] = await Promise.all(tasks);
      setProductState({
        detail,
        reviews,
        boughtTogether,
        similar,
        selectedVariantId: detail.variants?.find((variant) => variant.is_default)?.id || detail.variants?.[0]?.id || null,
        selectedImageUrl: detail.image_url || detail.image_urls?.[0] || detail.thumbnail_url || null,
      });
    });
  }

  async function loadProfileView() {
    if (!auth || !isCustomer) return;
    await withLoading("profile", async () => {
      const [profile, browsing, wishlist, orders] = await Promise.all([
        api.profile(auth.access_token),
        api.browsingHistory(auth.access_token),
        api.wishlist(auth.access_token),
        api.orderHistory(auth.access_token),
      ]);
      setProfileData((current) => ({
        ...current,
        profile,
        browsing,
        wishlist,
        orders,
        addressDraft: profile.addresses?.[0]
          ? {
              contact_name: profile.addresses[0].contact_name,
              phone: profile.addresses[0].phone,
              province: profile.addresses[0].province,
              city: profile.addresses[0].city,
              district: profile.addresses[0].district,
              address_line: profile.addresses[0].address_line,
              postal_code: profile.addresses[0].postal_code,
              is_default: profile.addresses[0].is_default,
            }
          : current.addressDraft,
      }));
    });
  }

  async function loadDashboardData(showSpinner) {
    if (!auth || !isStaff) return;
    setErrors((current) => ({ ...current, dashboard: null }));
    if (showSpinner) {
      await withLoading("dashboard", async () => {
        await refreshDashboardPayload();
      });
      return;
    }
    try {
      await refreshDashboardPayload();
    } catch (error) {
      showError(error);
    }
  }

  async function refreshDashboardPayload() {
    const forecastRange = RANGE_OPTIONS.find((item) => item.value === range)?.forecastDays || 7;
    const results = await Promise.allSettled([
      api.dashboard(auth.access_token),
      api.warRoom(auth.access_token),
      api.categoryPerformance(auth.access_token),
      api.geography(auth.access_token),
      api.rfm(auth.access_token),
      api.cohorts(auth.access_token),
      api.forecast(auth.access_token, forecastRange),
      api.adminOrders({ limit: 20, sort: "desc" }, auth.access_token),
      api.stockouts(auth.access_token),
      api.inventoryAlerts(auth.access_token),
    ]);
    const [
      dashboardResult,
      warRoomResult,
      categoryPerformanceResult,
      geographyResult,
      rfmResult,
      cohortsResult,
      forecastResult,
      ordersResult,
      stockoutsResult,
      inventoryAlertsResult,
    ] = results;
    const dashboardError = results.find((item) => item.status === "rejected");
    if (dashboardError) {
      setErrors((current) => ({
        ...current,
        dashboard: messageFromError(dashboardError.reason),
      }));
    }
    setAdminData((current) => ({
      ...current,
      dashboard: dashboardResult.status === "fulfilled" ? dashboardResult.value : current.dashboard,
      warRoom: warRoomResult.status === "fulfilled" ? warRoomResult.value : current.warRoom,
      categoryPerformance: categoryPerformanceResult.status === "fulfilled" ? categoryPerformanceResult.value : current.categoryPerformance,
      geography: geographyResult.status === "fulfilled" ? geographyResult.value : current.geography,
      rfm: rfmResult.status === "fulfilled" ? rfmResult.value : current.rfm,
      cohorts: cohortsResult.status === "fulfilled" ? cohortsResult.value : current.cohorts,
      forecast: forecastResult.status === "fulfilled" ? forecastResult.value : current.forecast,
      orders: ordersResult.status === "fulfilled" ? ordersResult.value : current.orders,
      stockouts: stockoutsResult.status === "fulfilled" ? stockoutsResult.value : current.stockouts,
      inventoryAlerts: inventoryAlertsResult.status === "fulfilled" ? inventoryAlertsResult.value : current.inventoryAlerts,
    }));
    if (
      dashboardResult.status === "rejected" &&
      warRoomResult.status === "rejected" &&
      !adminData.warRoom
    ) {
      throw warRoomResult.reason;
    }
  }

  async function loadAdminView() {
    if (!auth || !isStaff) return;
    setErrors((current) => ({ ...current, admin: null }));
    await withLoading("admin", async () => {
      const results = await Promise.allSettled([
        api.adminSummary(auth.access_token),
        api.adminOrders({ limit: 50, sort: "desc" }, auth.access_token),
        api.adminUsers(auth.access_token),
        api.suspicious(auth.access_token),
        api.funnel(auth.access_token),
        api.logs(auth.access_token),
        api.stockouts(auth.access_token),
        api.inventoryAlerts(auth.access_token),
        isAdmin ? api.salesAccounts(auth.access_token) : Promise.resolve([]),
      ]);
      const [
        summaryResult,
        ordersResult,
        adminUsersResult,
        suspiciousResult,
        funnelResult,
        logsResult,
        stockoutsResult,
        inventoryAlertsResult,
        salesAccountsResult,
      ] = results;
      const adminError = results.find((item) => item.status === "rejected");
      if (adminError) {
        setErrors((current) => ({
          ...current,
          admin: messageFromError(adminError.reason),
        }));
      }
      setAdminData((current) => ({
        ...current,
        summary: summaryResult.status === "fulfilled" ? summaryResult.value : current.summary,
        orders: ordersResult.status === "fulfilled" ? ordersResult.value : current.orders,
        adminUsers: adminUsersResult.status === "fulfilled" ? adminUsersResult.value : current.adminUsers,
        suspicious: suspiciousResult.status === "fulfilled" ? suspiciousResult.value : current.suspicious,
        funnel: funnelResult.status === "fulfilled" ? funnelResult.value : current.funnel,
        logs: logsResult.status === "fulfilled" ? logsResult.value : current.logs,
        stockouts: stockoutsResult.status === "fulfilled" ? stockoutsResult.value : current.stockouts,
        inventoryAlerts: inventoryAlertsResult.status === "fulfilled" ? inventoryAlertsResult.value : current.inventoryAlerts,
        salesAccounts: salesAccountsResult.status === "fulfilled" ? salesAccountsResult.value : current.salesAccounts,
      }));
      if (summaryResult.status === "rejected" && !adminData.summary) {
        throw summaryResult.reason;
      }
    });
  }

  async function handleLogin(payload) {
    await withLoading("login", async () => {
      const token = await api.login(payload);
      setAuth(token);
      setToast({ type: "success", message: `Logged in as ${token.user.role}.` });
      navigate(token.user.role === "customer" ? "/" : "/dashboard");
    });
  }

  async function handleRegister(payload) {
    await withLoading("register", async () => {
      await api.register(payload);
      setToast({ type: "success", message: "Registration complete. You can now log in." });
    });
  }

  function handleLogout() {
    setAuth(null);
    navigate("/");
    setToast({ type: "success", message: "Logged out." });
  }

  function addToCart(product, variant = null) {
    setCart((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id && String(item.variant_id || "") === String(variant?.id || "")
      );
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id && String(item.variant_id || "") === String(variant?.id || "")
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          variant_id: variant?.id || null,
          name: product.name,
          image_url: variant?.image_url || product.image_url || null,
          thumbnail_url: product.thumbnail_url || variant?.image_url || product.image_url || null,
          category_name: product.category_name || "",
          variant_label: variant ? `${variant.color} / ${variant.size}` : "Default",
          quantity: 1,
          unit_price: product.price,
        },
      ];
    });
    setToast({ type: "success", message: `${product.name} added to cart.` });
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (!auth || !isCustomer) return;
    await withLoading("checkout", async () => {
      await api.checkout(
        {
          shipping_address: checkout.shipping_address,
          payment_method: checkout.payment_method,
          coupon_code: checkout.coupon_code,
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id,
          })),
        },
        auth.access_token
      );
      setCart([]);
      setCheckout({ shipping_address: "", payment_method: "card", coupon_code: "" });
      setToast({ type: "success", message: "Checkout completed successfully." });
      await loadProfileView();
    });
  }

  async function saveAddress(event) {
    event.preventDefault();
    if (!auth || !isCustomer) return;
    await withLoading("save-address", async () => {
      await api.createAddress(profileData.addressDraft, auth.access_token);
      setToast({ type: "success", message: "Address saved." });
      await loadProfileView();
    });
  }

  async function removeAddress(id) {
    await withLoading("delete-address", async () => {
      await api.deleteAddress(id, auth.access_token);
      setToast({ type: "success", message: "Address deleted." });
      await loadProfileView();
    });
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!auth || !isStaff) return;
    const payload = {
      category_id: Number(productForm.category_id),
      name: productForm.name,
      brand: productForm.brand,
      description: productForm.description,
      price: Number(productForm.price),
      stock_quantity: Number(productForm.stock_quantity),
      image_url: productForm.image_url,
      tags_json: productForm.tags.split(",").map((item) => item.trim()).filter(Boolean),
      variants: productForm.variants.map((variant, index) => ({
        sku: variant.sku || `${productForm.name.replace(/\s+/g, "-").toUpperCase()}-${index + 1}`,
        color: variant.color || "Default",
        size: variant.size || "Std",
        stock_quantity: Number(variant.stock_quantity || productForm.stock_quantity),
        image_url: variant.image_url || productForm.image_url,
        is_default: index === 0,
      })),
    };
    await withLoading("save-product", async () => {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload, auth.access_token);
      } else {
        await api.createProduct(payload, auth.access_token);
      }
      setEditingProduct(null);
      setProductForm(DEFAULT_PRODUCT_FORM);
      setToast({ type: "success", message: `Product ${editingProduct ? "updated" : "created"}.` });
      const homepageProducts = await api.getProducts({ sort_by: "updated_at" });
      setPublicData((current) => ({ ...current, homepageProducts }));
      setProductPageProducts(homepageProducts);
    });
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (!auth || !isStaff) return;
    await withLoading("save-category", async () => {
      await api.createCategory(
        {
          name: categoryForm.name,
          description: categoryForm.description,
          parent_id: categoryForm.parent_id ? Number(categoryForm.parent_id) : null,
        },
        auth.access_token
      );
      setCategoryForm({ name: "", description: "", parent_id: "" });
      setToast({ type: "success", message: "Category created." });
      const categories = await api.getCategories();
      setPublicData((current) => ({ ...current, categories }));
    });
  }

  async function openUserDetail(userId) {
    if (!userId) {
      setAdminData((current) => ({ ...current, selectedUser: null }));
      return;
    }
    await withLoading("user-detail", async () => {
      const detail = await api.adminUserDetail(userId, auth.access_token);
      setAdminData((current) => ({ ...current, selectedUser: detail }));
    });
  }

  const routeMeta = getRouteMeta(route);
  const pageTitle = isStaff
    ? routeMeta.staffTitle
    : routeMeta.customerTitle;

  return (
    <div className={route.startsWith("/dashboard") || route.startsWith("/admin") ? "app app-dark app-staff" : "app app-dark"}>
      <Header
        auth={auth}
        route={route}
        navigate={navigate}
        onLogout={handleLogout}
        cartCount={cart.length}
      />

      {toast ? (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="ghost-button" onClick={() => setToast(null)}>Dismiss</button>
        </div>
      ) : null}

      {!auth ? (
        <LandingPage
          banners={publicData.banners}
          categories={topCategories}
          trending={publicData.trending}
          onLogin={handleLogin}
          onRegister={handleRegister}
          loading={loading}
          navigate={navigate}
        />
      ) : null}

      {((auth && !isStaff) || (!auth && route !== "/")) ? (
        <main className="shell page-enter">
          {auth ? (
            <HeroSummary
              title={pageTitle}
              subtitle="Customer experience with recommendations, search, coupons, addresses, and order history."
            />
          ) : null}
          {route === "/" ? (
            <HomePage
              banners={publicData.banners}
              categories={topCategories}
              products={publicData.homepageProducts}
              trending={publicData.trending}
              personalized={publicData.personalized}
              onOpenProduct={(id) => navigate(`/product/${id}`)}
              onSearch={() => navigate("/search")}
              onAddToCart={addToCart}
            />
          ) : null}
          {route === "/search" ? (
            <SearchPage
              state={searchState}
              setState={setSearchState}
              categories={publicData.categories}
              loading={loading.search}
              onOpenProduct={(id) => navigate(`/product/${id}`)}
              onSearch={loadSearchResults}
            />
          ) : null}
          {route.startsWith("/product/") ? (
            <ProductPage
              productState={productState}
              setProductState={setProductState}
              loading={loading.product}
              onBack={() => navigate("/search")}
              onAddToCart={addToCart}
              onOpenProduct={(id) => navigate(`/product/${id}`)}
            />
          ) : null}
          {route === "/cart" ? (
            <CartPage
              cart={cart}
              checkout={checkout}
              setCheckout={setCheckout}
              onSubmit={submitCheckout}
              loading={loading.checkout}
            />
          ) : null}
          {route === "/profile" && auth ? (
            <ProfilePage
              profileData={profileData}
              setProfileData={setProfileData}
              onSaveAddress={saveAddress}
              onDeleteAddress={removeAddress}
            />
          ) : null}
        </main>
      ) : null}

      {auth && isStaff ? (
        <div className="staff-shell page-enter">
          <StaffSidebar route={route} navigate={navigate} />
          <main className={route === "/dashboard" ? "dashboard-shell staff-main" : "shell admin-shell staff-main"}>
            {route === "/dashboard" ? (
              <DashboardPage
                data={adminData}
                loading={loading.dashboard}
                error={errors.dashboard}
                range={range}
                setRange={setRange}
                onRetry={() => void loadDashboardData(true)}
              />
            ) : null}
            {route === "/admin" ? (
              <AdminOverviewPage summary={adminData.summary} loading={loading.admin} error={errors.admin} navigate={navigate} onRetry={() => void loadAdminView()} />
            ) : null}
            {route === "/admin/products" ? (
              <AdminProductsPage
                products={publicData.homepageProducts}
                categories={publicData.categories}
                productForm={productForm}
                setProductForm={setProductForm}
                editingProduct={editingProduct}
                setEditingProduct={setEditingProduct}
                onSaveProduct={saveProduct}
                categoryForm={categoryForm}
                setCategoryForm={setCategoryForm}
                onSaveCategory={saveCategory}
                loading={loading.admin}
                error={errors.admin}
                onRetry={() => void loadAdminView()}
              />
            ) : null}
            {route === "/admin/orders" ? (
              <AdminOrdersPage
                orders={adminData.orders}
                stockouts={adminData.stockouts}
                loading={loading.admin}
                error={errors.admin}
                onRetry={() => void loadAdminView()}
              />
            ) : null}
            {route === "/admin/users" ? (
              <AdminUsersPage
                users={adminData.adminUsers}
                selectedUser={adminData.selectedUser}
                suspicious={adminData.suspicious}
                onOpenUser={openUserDetail}
                loading={loading.admin}
                error={errors.admin}
                onRetry={() => void loadAdminView()}
              />
            ) : null}
            {route === "/admin/reports" ? (
              <AdminReportsPage
                dashboard={adminData.dashboard}
                categoryPerformance={adminData.categoryPerformance}
                geography={adminData.geography}
                rfm={adminData.rfm}
                cohorts={adminData.cohorts}
                forecast={adminData.forecast}
                funnel={adminData.funnel}
                logs={adminData.logs}
                inventoryAlerts={adminData.inventoryAlerts}
                loading={loading.admin}
                error={errors.admin}
                onRetry={() => void loadAdminView()}
              />
            ) : null}
          </main>
        </div>
      ) : null}

      <Footer navigate={navigate} />
    </div>
  );
}

function getRouteMeta(route) {
  if (route === "/") return { customerTitle: "Smart storefront and personalized homepage", staffTitle: "Overview" };
  if (route === "/search") return { customerTitle: "Search and discovery center", staffTitle: "Overview" };
  if (route.startsWith("/product/")) return { customerTitle: "Product detail and cross-sell page", staffTitle: "Overview" };
  if (route === "/cart") return { customerTitle: "Cart and checkout journey", staffTitle: "Overview" };
  if (route === "/profile") return { customerTitle: "Membership, coupons, browsing, and order center", staffTitle: "Overview" };
  if (route === "/dashboard") return { customerTitle: "", staffTitle: "War Room Analytics Dashboard" };
  if (route === "/admin") return { customerTitle: "", staffTitle: "Admin Summary Dashboard" };
  if (route === "/admin/products") return { customerTitle: "", staffTitle: "Product and inventory management" };
  if (route === "/admin/orders") return { customerTitle: "", staffTitle: "Order operations and detail drawer" };
  if (route === "/admin/users") return { customerTitle: "", staffTitle: "User insights and suspicious activity" };
  return { customerTitle: "Commerce workspace", staffTitle: "Analytics reports and exports" };
}

function Header({ auth, route, navigate, onLogout, cartCount }) {
  const customerLinks = [
    { label: "Home", path: "/" },
    { label: "Search", path: "/search" },
    { label: `Cart ${cartCount ? `(${cartCount})` : ""}`, path: "/cart" },
    { label: "Profile", path: "/profile" },
  ];
  const staffLinks = [
    { label: "War Room", path: "/dashboard" },
    { label: "Admin", path: "/admin" },
    { label: "Products", path: "/admin/products" },
    { label: "Orders", path: "/admin/orders" },
    { label: "Users", path: "/admin/users" },
    { label: "Reports", path: "/admin/reports" },
  ];
  const links = !auth ? [] : auth.user.role === "customer" ? customerLinks : staffLinks;
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Smart Commerce Analytics Platform</p>
        <h1>Smart Commerce Analytics</h1>
      </div>
      <button className="nav-toggle" onClick={() => document.body.classList.toggle("show-mobile-nav")}>Menu</button>
      <nav className="nav-links">
        {links.map((link) => (
          <button
            key={link.path}
            className={route === link.path ? "nav-link active" : "nav-link"}
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        {auth ? (
          <>
            <span className="role-pill">{auth.user.username} / {auth.user.role}</span>
            <button className="ghost-button" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <span className="role-pill">Guest browsing enabled</span>
        )}
      </div>
    </header>
  );
}

function StaffSidebar({ route, navigate }) {
  const items = [
    { index: "01 /", label: "Overview", path: "/dashboard" },
    { index: "02 /", label: "Admin Home", path: "/admin" },
    { index: "03 /", label: "Products", path: "/admin/products" },
    { index: "04 /", label: "Orders", path: "/admin/orders" },
    { index: "05 /", label: "Users", path: "/admin/users" },
    { index: "06 /", label: "Reports", path: "/admin/reports" },
  ];
  return (
    <aside className="staff-sidebar">
      <div className="staff-sidebar-head">
        <p className="section-index">00 /</p>
        <h2>Control</h2>
      </div>
      <nav className="staff-sidebar-nav">
        {items.map((item) => (
          <button
            key={item.path}
            className={route === item.path ? "staff-link active" : "staff-link"}
            onClick={() => navigate(item.path)}
          >
            <span className="section-index">{item.index}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function HeroSummary({ title, subtitle }) {
  return (
    <section className="hero-summary">
      <div>
        <p className="eyebrow">Frontend & Polish Sprint</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </section>
  );
}

function LandingPage({ banners, categories, trending, onLogin, onRegister, loading, navigate }) {
  return (
    <main className="shell">
      <section className="auth-split-section">
        <div className="auth-visual">
          <div className="glow-orb glow-one" />
          <div className="glow-orb glow-two" />
          <SectionIntro
            index="01 /"
            title="Smart Commerce Analytics"
            subtitle="The future of retail intelligence starts here."
            description="A premium dark-mode commerce intelligence workspace for customers, sales teams, and admins."
            action={<button onClick={() => navigate("/search")}>Explore Dashboard -&gt;</button>}
          />
        </div>
        <div className="auth-panels">
          <AuthCard type="login" onSubmit={onLogin} loading={loading.login} />
          <AuthCard type="register" onSubmit={onRegister} loading={loading.register} />
        </div>
      </section>
      <SectionSplit
        index="02 /"
        title="Shop Smarter"
        description="Personalized recommendations, real-time inventory, and seamless checkout."
        right={
          <FeatureCardStack
            items={[
              { title: "AI Recommendations", body: "Browse-to-buy paths tuned by collaborative filtering." },
              { title: "Live Inventory", body: "See stock levels update in real time." },
              { title: "Secure Checkout", body: "Encrypted payments with instant confirmation." },
            ]}
          />
        }
      />
      <SectionSplit
        index="03 /"
        title="Command Center"
        description="War-room analytics, RFM segmentation, and predictive forecasting."
        right={
          <FeatureCardStack
            items={[
              { title: "War Room Dashboard", body: "Full-screen ECharts visualization with real-time KPIs." },
              { title: "RFM Segmentation", body: "Auto-classify customers into Champions, Loyal, At Risk, Lost." },
              { title: "Sales Forecasting", body: "7-day and 30-day trend predictions with anomaly alerts." },
            ]}
          />
        }
      />
      <section className="quote-section">
        <div className="quote-avatar" />
        <blockquote>"This platform redefined how we understand our customers."</blockquote>
        <p>Sales Manager</p>
      </section>
      <RecommendationStrip title="Trending Now" items={trending} onOpen={(id) => navigate(`/product/${id}`)} />
      <section className="panel">
        <div className="section-title">
          <h3>Category Quick Links</h3>
          <span>{categories.length} curated groups</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button key={category.id} className="category-tile" onClick={() => navigate("/search")}>
              <strong>{category.name}</strong>
              <span>{category.description}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthCard({ type, onSubmit, loading }) {
  const isLogin = type === "login";
  const [form, setForm] = useState(isLogin ? DEFAULT_LOGIN : DEFAULT_REGISTER);
  const [captchaSeed, setCaptchaSeed] = useState(() => generateCaptchaSeed());
  const [answer, setAnswer] = useState("");

  function submit(event) {
    event.preventDefault();
    if (Number(answer) !== captchaSeed.answer) return;
    onSubmit(form);
    setCaptchaSeed(generateCaptchaSeed());
    setAnswer("");
  }

  return (
    <form className="panel auth-card" onSubmit={submit}>
      <div className="section-title">
        <h3>{isLogin ? "Login" : "Customer Register"}</h3>
        <span>{isLogin ? "Use seeded accounts" : "Create a course demo account"}</span>
      </div>
      <input
        value={form.username}
        onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
        placeholder="Username"
      />
      {!isLogin ? (
        <input
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="Email"
        />
      ) : null}
      <input
        type="password"
        value={form.password}
        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        placeholder="Password"
      />
      <div className="captcha-box">
        <CanvasCaptcha equation={captchaSeed.equation} />
        <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Solve CAPTCHA" />
      </div>
      <button type="submit" disabled={loading || Number(answer) !== captchaSeed.answer}>
        {loading ? "Working..." : isLogin ? "Enter Platform" : "Create Account"}
      </button>
    </form>
  );
}

function SectionIntro({ index, title, subtitle, description, action }) {
  return (
    <div className="section-copy">
      <p className="section-index">{index}</p>
      <h2>{title}</h2>
      {subtitle ? <h3>{subtitle}</h3> : null}
      <p>{description}</p>
      {action ? <div className="quick-actions">{action}</div> : null}
    </div>
  );
}

function SectionSplit({ index, title, subtitle, description, action, right, hero = false }) {
  return (
    <section className={hero ? "section-split hero-split" : "section-split"}>
      <div className="section-pane section-pane-left">
        <SectionIntro index={index} title={title} subtitle={subtitle} description={description} action={action} />
      </div>
      <div className="section-pane section-pane-right">
        {right}
      </div>
    </section>
  );
}

function FeatureCardStack({ items }) {
  return (
    <div className="feature-stack">
      {items.map((item) => (
        <article className="feature-card" key={item.title}>
          <span className="feature-dot" />
          <div>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
            <button className="link-button">Read More -&gt;</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CanvasCaptcha({ equation }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "#eff6ff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = "20px Segoe UI";
    context.fillStyle = "#1e3a8a";
    context.fillText(equation, 18, 28);
    for (let index = 0; index < 8; index += 1) {
      context.strokeStyle = `rgba(37, 99, 235, ${0.15 + index * 0.03})`;
      context.beginPath();
      context.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      context.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      context.stroke();
    }
  }, [equation]);
  return <canvas ref={ref} width="150" height="42" className="captcha-canvas" aria-label="captcha equation" />;
}

function BannerCarousel({ banners, compact }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!banners.length) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, [banners]);
  if (!banners.length) return <div className={compact ? "banner banner-compact" : "banner"}>No active banners.</div>;
  const active = banners[index];
  return (
    <div className={compact ? "banner banner-compact" : "banner"}>
      <div className="banner-art" />
      <div className="banner-copy">
        <span className="eyebrow">Campaign</span>
        <h3>{active.title}</h3>
        <p>{active.subtitle}</p>
      </div>
    </div>
  );
}

function HomePage({ banners, categories, products, trending, personalized, onOpenProduct, onSearch, onAddToCart }) {
  const newArrivals = products.slice(0, 8);
  const limitedOffers = products.filter((item) => (item.tags_json || []).includes("limited-stock")).slice(0, 8);
  return (
    <>
      <SectionSplit
        hero
        index="01 /"
        title="Smart Commerce Analytics"
        subtitle="The future of retail intelligence starts here."
        description="Personalized retail discovery, live inventory insight, and a premium dark-mode storefront built on real analytics."
        action={<button onClick={onSearch}>Explore Dashboard -&gt;</button>}
        right={<BannerCarousel banners={banners} compact={false} />}
      />
      <SectionSplit
        index="02 /"
        title="Shop Smarter"
        description="Personalized recommendations, real-time inventory, and seamless checkout."
        right={
          <div className="stacked-mix">
            <FeatureCardStack
              items={[
                { title: "AI Recommendations", body: "Browse-to-buy paths tuned by collaborative filtering." },
                { title: "Live Inventory", body: "See stock levels update in real time." },
                { title: "Secure Checkout", body: "Encrypted payments with instant confirmation." },
              ]}
            />
            {personalized.length ? <RecommendationStrip title="For You" items={personalized} onOpen={onOpenProduct} onAdd={onAddToCart} compact /> : null}
          </div>
        }
      />
      <SectionSplit
        index="03 /"
        title="Command Center"
        description="War-room analytics, RFM segmentation, and predictive forecasting."
        right={
          <div className="stacked-mix">
            <FeatureCardStack
              items={[
                { title: "War Room Dashboard", body: "Full-screen ECharts visualization with real-time KPIs." },
                { title: "RFM Segmentation", body: "Auto-classify customers into Champions, Loyal, At Risk, Lost." },
                { title: "Sales Forecasting", body: "7-day and 30-day trend predictions with anomaly alerts." },
              ]}
            />
            <RecommendationStrip title="Trending Now" items={trending} onOpen={onOpenProduct} onAdd={onAddToCart} compact />
          </div>
        }
      />
      <section className="quote-section">
        <div className="quote-avatar" />
        <blockquote>"This platform redefined how we understand our customers."</blockquote>
        <p>Sales Manager</p>
      </section>
      <ProductSection title="New Arrivals" items={newArrivals} onOpen={onOpenProduct} onAdd={onAddToCart} />
      <ProductSection title="Limited Offers" items={limitedOffers} onOpen={onOpenProduct} onAdd={onAddToCart} />
      <section className="panel">
        <div className="section-title">
          <h3>Category Quick Links</h3>
          <button className="ghost-button" onClick={onSearch}>Read More -&gt;</button>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button key={category.id} className="category-tile" onClick={onSearch}>
              <strong>{category.name}</strong>
              <span>{category.description}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function SearchPage({ state, setState, categories, loading, onOpenProduct, onSearch }) {
  const totalPages = Math.max(1, Math.ceil((state.total || 0) / 12));
  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h3>Search & Filter</h3>
          <span>{state.total} results</span>
        </div>
        <div className="search-layout">
          <div className="search-primary">
            <input
              value={state.q}
              onChange={(event) => setState((current) => ({ ...current, q: event.target.value, page: 1 }))}
              placeholder="Search products, brands, descriptions"
            />
            {state.suggestions.length ? (
              <div className="suggestion-list">
                {state.suggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion.keyword}
                    className="suggestion-item"
                    onClick={() => setState((current) => ({ ...current, q: suggestion.keyword, page: 1 }))}
                  >
                    <span>{suggestion.keyword}</span>
                    <small>{suggestion.search_count}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="search-filters">
            <select value={state.category_id} onChange={(event) => setState((current) => ({ ...current, category_id: event.target.value, page: 1 }))}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <input value={state.brand} onChange={(event) => setState((current) => ({ ...current, brand: event.target.value, page: 1 }))} placeholder="Brand" />
            <input value={state.min_price} onChange={(event) => setState((current) => ({ ...current, min_price: event.target.value, page: 1 }))} placeholder="Min price" />
            <input value={state.max_price} onChange={(event) => setState((current) => ({ ...current, max_price: event.target.value, page: 1 }))} placeholder="Max price" />
            <select value={state.min_rating} onChange={(event) => setState((current) => ({ ...current, min_rating: event.target.value, page: 1 }))}>
              <option value="">Any rating</option>
              <option value="4">4+ stars</option>
              <option value="3">3+ stars</option>
            </select>
            <select value={state.sort} onChange={(event) => setState((current) => ({ ...current, sort: event.target.value, page: 1 }))}>
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price Low-High</option>
              <option value="price_desc">Price High-Low</option>
              <option value="sales">Sales</option>
              <option value="newest">Newest</option>
            </select>
            <button onClick={onSearch}>Search</button>
          </div>
        </div>
      </section>
      {loading ? <LoadingPanel label="Loading search results..." /> : null}
      {!loading && !state.results.length ? (
        <section className="panel empty-state">
          <h3>No results found</h3>
          <p>Try a broader keyword or explore the trending suggestions above.</p>
        </section>
      ) : null}
      {state.results.length ? (
        <ProductSection title="Search Results" items={state.results} onOpen={onOpenProduct} />
      ) : null}
      <section className="panel pagination-bar">
        <button className="ghost-button" disabled={state.page <= 1} onClick={() => setState((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>Page {state.page} / {totalPages}</span>
        <button className="ghost-button" disabled={state.page >= totalPages} onClick={() => setState((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </section>
    </>
  );
}

function ProductPage({ productState, setProductState, loading, onBack, onAddToCart, onOpenProduct }) {
  if (loading || !productState.detail) return <LoadingPanel label="Loading product detail..." />;
  const { detail, reviews, boughtTogether, similar, selectedVariantId, selectedImageUrl } = productState;
  const selectedVariant = detail.variants?.find((variant) => variant.id === selectedVariantId) || detail.variants?.[0];
  const galleryImages = Array.from(
    new Set(
      [
        selectedVariant?.image_url,
        detail.image_url,
        detail.thumbnail_url,
        ...(detail.image_urls || []),
      ].filter(Boolean)
    )
  );
  const activeImage = selectedImageUrl || galleryImages[0] || null;
  const stockLabel = selectedVariant?.stock_quantity <= 0
    ? "Out of Stock"
    : selectedVariant?.stock_quantity < 10
      ? "Low Stock"
      : "In Stock";
  const starBuckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));

  return (
    <>
      <section className="panel">
        <div className="section-title">
          <button className="ghost-button" onClick={onBack}>Back to Search</button>
          <span className={`status-pill ${stockLabel === "In Stock" ? "success" : stockLabel === "Low Stock" ? "warning" : "danger"}`}>{stockLabel}</span>
        </div>
        <div className="product-layout">
          <div className="gallery-column">
            <ProductImage
              src={activeImage}
              fallbackKey={detail.category_name}
              alt={detail.name}
              productId={detail.id}
              className="product-image product-image-detail"
              containerClassName="gallery-main product-image-shell"
              showLabel={false}
            />
            <div className="thumbnail-row">
              {galleryImages.slice(0, 5).map((imageUrl, index) => (
                <button
                  key={`${imageUrl}-${index}`}
                  className={activeImage === imageUrl ? "thumbnail active thumbnail-image-button" : "thumbnail thumbnail-image-button"}
                  onClick={() => setProductState((current) => ({ ...current, selectedImageUrl: imageUrl }))}
                >
                  <ProductImage
                    src={imageUrl}
                    fallbackKey={detail.category_name}
                    alt={`${detail.name} preview ${index + 1}`}
                    productId={detail.id}
                    className="product-image thumbnail-image"
                    containerClassName="thumbnail-image-shell"
                    showLabel={false}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="detail-column">
            <span className="eyebrow">{detail.category_name}</span>
            <h2>{detail.name}</h2>
            <p>{detail.description}</p>
            <div className="stats-inline">
              <strong>CNY {Number(detail.price).toFixed(2)}</strong>
              <span>{detail.brand || "Generic"}</span>
              <span>{detail.review_count} reviews</span>
              <span>{detail.rating_average} avg rating</span>
            </div>
            <div className="variant-group">
              {(detail.variants || []).map((variant) => (
                <button
                  key={variant.id}
                  className={selectedVariantId === variant.id ? "variant-chip active" : "variant-chip"}
                  onClick={() => setProductState((current) => ({
                    ...current,
                    selectedVariantId: variant.id,
                    selectedImageUrl: variant.image_url || current.selectedImageUrl,
                  }))}
                >
                  {variant.color} / {variant.size}
                </button>
              ))}
            </div>
            <div className="review-bars">
              {starBuckets.map((bucket) => (
                <div className="review-row" key={bucket.star}>
                  <span>{bucket.star} star</span>
                  <div className="review-bar-track">
                    <div className="review-bar-fill" style={{ width: `${reviews.length ? (bucket.count / reviews.length) * 100 : 0}%` }} />
                  </div>
                  <strong>{bucket.count}</strong>
                </div>
              ))}
            </div>
            <button onClick={() => onAddToCart(detail, selectedVariant)}>Add to Cart</button>
          </div>
        </div>
      </section>
      <section className="product-tabs">
        <button className="tab-link active">Description</button>
        <button className="tab-link">Reviews</button>
        <button className="tab-link">Recommendations</button>
      </section>
      <section className="panel product-tab-card">
        <div className="section-title">
          <h3>Description</h3>
          <span>Overview</span>
        </div>
        <p>{detail.description}</p>
      </section>
      <RecommendationStrip title="Frequently Bought Together" items={boughtTogether} onOpen={onOpenProduct} />
      <RecommendationStrip title="More Like This" items={similar} onOpen={onOpenProduct} />
      <section className="panel product-tab-card">
        <div className="section-title">
          <h3>Recent Reviews</h3>
          <span>{reviews.length} total</span>
        </div>
        <div className="review-grid">
          {reviews.slice(0, 6).map((review) => (
            <article className="review-card" key={review.id}>
              <div className="section-title compact">
                <strong>{review.user_name}</strong>
                <span>{review.rating} / 5</span>
              </div>
              <h4>{review.title}</h4>
              <p>{review.content}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function CartPage({ cart, checkout, setCheckout, onSubmit, loading }) {
  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  return (
    <section className="checkout-grid">
      <div className="panel">
        <div className="section-title">
          <h3>Shopping Cart</h3>
          <span>{cart.length} items</span>
        </div>
        <div className="stack-list">
          {cart.map((item) => (
            <div className="list-row" key={`${item.product_id}-${item.variant_id || "base"}`}>
              <div className="list-row-media">
                <ProductImage
                  src={item.thumbnail_url || item.image_url}
                  fallbackKey={item.category_name}
                  alt={item.name}
                  productId={item.product_id}
                  className="product-image cart-thumb-image"
                  containerClassName="cart-thumb-shell"
                  showLabel={false}
                />
                <div>
                <strong>{item.name}</strong>
                <p>{item.variant_label}</p>
                </div>
              </div>
              <span>{item.quantity} x CNY {item.unit_price.toFixed(2)}</span>
            </div>
          ))}
          {!cart.length ? <p className="muted-copy">Your cart is empty.</p> : null}
        </div>
      </div>
      <form className="panel" onSubmit={onSubmit}>
        <div className="section-title">
          <h3>Checkout</h3>
          <strong>CNY {total.toFixed(2)}</strong>
        </div>
        <div className="stack-list">
          <textarea value={checkout.shipping_address} onChange={(event) => setCheckout((current) => ({ ...current, shipping_address: event.target.value }))} placeholder="Shipping address" />
          <select value={checkout.payment_method} onChange={(event) => setCheckout((current) => ({ ...current, payment_method: event.target.value }))}>
            <option value="card">Card</option>
            <option value="alipay">Alipay</option>
            <option value="wechat">WeChat</option>
          </select>
          <input value={checkout.coupon_code} onChange={(event) => setCheckout((current) => ({ ...current, coupon_code: event.target.value }))} placeholder="Coupon code" />
          <button type="submit" disabled={!cart.length || loading}>Complete Purchase</button>
        </div>
      </form>
    </section>
  );
}

function ProfilePage({ profileData, setProfileData, onSaveAddress, onDeleteAddress }) {
  const profile = profileData.profile;
  if (!profile) return <LoadingPanel label="Loading profile..." />;
  const coupons = profile.coupons || [];
  const now = Date.now();
  const filteredCoupons = coupons.filter((coupon) => {
    const expired = coupon.expires_at && new Date(coupon.expires_at).getTime() < now;
    if (profileData.couponTab === "active") return !coupon.is_used && !expired;
    if (profileData.couponTab === "used") return coupon.is_used;
    return expired;
  });
  const membershipProgress = getTierProgress(profile.membership_tier);
  return (
    <>
      <section className="profile-grid">
        <div className="panel">
          <div className="section-title">
            <h3>Membership Tier</h3>
            <span>{profile.membership_tier.toUpperCase()}</span>
          </div>
          <div className="membership-meter">
            <div className="membership-fill" style={{ width: `${membershipProgress}%` }} />
          </div>
          <p>Progress to next tier: {membershipProgress}%</p>
          <div className="stack-list mini">
            <span>Total Orders: {profile.summary.order_count}</span>
            <span>Total Spend: CNY {profile.summary.total_spent.toFixed(2)}</span>
            <span>Preferred: {(profile.preferred_categories || []).join(", ")}</span>
          </div>
        </div>
        <div className="panel">
          <div className="section-title">
            <h3>Coupons</h3>
            <div className="tab-strip">
              {["active", "used", "expired"].map((tab) => (
                <button
                  key={tab}
                  className={profileData.couponTab === tab ? "nav-link active" : "nav-link"}
                  onClick={() => setProfileData((current) => ({ ...current, couponTab: tab }))}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="stack-list">
            {filteredCoupons.map((coupon) => (
              <div key={coupon.id} className="coupon-card">
                <strong>{coupon.code}</strong>
                <span>{coupon.discount_type} / {coupon.discount_value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h3>Browsing History</h3>
          <span>{profileData.browsing.length} events</span>
        </div>
        <div className="stack-list">
          {profileData.browsing.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <strong>{item.content}</strong>
                <p>{item.category_name}</p>
              </div>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="profile-grid">
        <form className="panel" onSubmit={onSaveAddress}>
          <div className="section-title">
            <h3>Address Book</h3>
            <span>{profile.addresses.length} saved</span>
          </div>
          <div className="stack-list">
            {["contact_name", "phone", "province", "city", "district", "address_line", "postal_code"].map((field) => (
              <input
                key={field}
                value={profileData.addressDraft[field] || ""}
                onChange={(event) => setProfileData((current) => ({
                  ...current,
                  addressDraft: { ...current.addressDraft, [field]: event.target.value },
                }))}
                placeholder={field.replace(/_/g, " ")}
              />
            ))}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={profileData.addressDraft.is_default}
                onChange={(event) => setProfileData((current) => ({
                  ...current,
                  addressDraft: { ...current.addressDraft, is_default: event.target.checked },
                }))}
              />
              Default address
            </label>
            <button type="submit">Save Address</button>
          </div>
        </form>
        <div className="panel">
          <div className="section-title">
            <h3>Saved Addresses</h3>
            <span>{profile.addresses.length} entries</span>
          </div>
          <div className="stack-list">
            {profile.addresses.map((address) => (
              <div className="list-row" key={address.id}>
                <div>
                  <strong>{address.contact_name}</strong>
                  <p>{address.province} {address.city} {address.address_line}</p>
                </div>
                <button className="ghost-button" onClick={() => onDeleteAddress(address.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h3>Order History</h3>
          <span>{profileData.orders.length} orders</span>
        </div>
        <div className="stack-list">
          {profileData.orders.map((order) => (
            <button
              className="list-row interactive-row"
              key={order.id}
              onClick={() => setProfileData((current) => ({ ...current, orderModal: order }))}
            >
              <div>
                <strong>Order #{order.id}</strong>
                <p>{order.status}</p>
              </div>
              <span>CNY {order.total_amount.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </section>
      {profileData.orderModal ? (
        <Modal title={`Order #${profileData.orderModal.id}`} onClose={() => setProfileData((current) => ({ ...current, orderModal: null }))}>
          <div className="stack-list">
            {(profileData.orderModal.items || []).map((item) => (
              <div className="list-row" key={`${profileData.orderModal.id}-${item.product_id}`}>
                <div className="list-row-media">
                  <ProductImage
                    src={item.thumbnail_url || item.image_url}
                    fallbackKey={item.category_name}
                    alt={item.product_name}
                    productId={item.product_id}
                    className="product-image cart-thumb-image"
                    containerClassName="cart-thumb-shell"
                    showLabel={false}
                  />
                  <div>
                    <strong>{item.product_name}</strong>
                    <p>{item.quantity} x CNY {Number(item.unit_price).toFixed(2)}</p>
                  </div>
                </div>
                <span>CNY {Number(item.quantity * item.unit_price).toFixed(2)}</span>
              </div>
            ))}
            {profileData.orderModal.timeline.map((step) => (
              <div className="timeline-step" key={`${profileData.orderModal.id}-${step.status}-${step.created_at}`}>
                <strong>{step.status}</strong>
                <span>{new Date(step.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function PageErrorState({ title, message, onRetry }) {
  return (
    <section className="panel loading-panel">
      <div className="stack-list">
        <h3>{title}</h3>
        <p>{message}</p>
        {onRetry ? <button onClick={onRetry}>Retry</button> : null}
      </div>
    </section>
  );
}

function DashboardPage({ data, loading, error, range, setRange, onRetry }) {
  if (loading && !data.warRoom) return <LoadingPanel label="Loading war room dashboard..." dark />;
  if (!loading && error && !data.warRoom) {
    return <PageErrorState title="Failed to load dashboard" message={error} onRetry={onRetry} />;
  }
  if (!data.warRoom) return <PageErrorState title="Dashboard unavailable" message="No dashboard data returned." onRetry={onRetry} />;
  return (
    <>
      <section className="dashboard-toolbar">
        <div>
          <p className="eyebrow">War Room</p>
          <h2>1920x1080 analytics large screen</h2>
        </div>
        <div className="dashboard-controls">
          <div className="tab-strip">
            {RANGE_OPTIONS.map((option) => (
              <button key={option.value} className={range === option.value ? "nav-link active" : "nav-link"} onClick={() => setRange(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          <button onClick={toggleFullscreen}>Fullscreen</button>
        </div>
      </section>
      <section className="dashboard-kpis">
        <KpiCard label="Today GMV" value={`CNY ${data.warRoom.kpis.gmv_today.toFixed(0)}`} />
        <KpiCard label="Active Users Now" value={data.warRoom.kpis.active_users_now} />
        <KpiCard label="Today Orders" value={data.warRoom.kpis.orders_today} />
        <KpiCard label="Low Stock Alerts" value={data.warRoom.inventory_alerts.length} />
      </section>
      <section className="dashboard-grid">
        <ChartPanel className="span-2" title="Sales Trend: Today vs Yesterday">
          <SalesTrendChart data={data.warRoom.trend_today_vs_yesterday} />
        </ChartPanel>
        <ChartPanel title="RFM Radar">
          <RfmRadarChart data={data.rfm} />
        </ChartPanel>
        <ChartPanel className="span-2" title="Category Share">
          <CategoryShareChart data={data.categoryPerformance} />
        </ChartPanel>
        <ChartPanel title="Real-time Ticker">
          <TickerList orders={data.orders} />
        </ChartPanel>
        <ChartPanel className="span-2" title="Province Sales Ranking">
          <GeographyBarChart data={data.geography} />
        </ChartPanel>
        <ChartPanel title="Cohort Heatmap">
          <CohortHeatmap data={data.cohorts} />
        </ChartPanel>
        <ChartPanel className="span-3" title="Forecast & Stockout Alerts">
          <ForecastAndAlerts forecast={data.forecast} stockouts={data.stockouts} />
        </ChartPanel>
      </section>
    </>
  );
}

function AdminOverviewPage({ summary, loading, error, navigate, onRetry }) {
  if (loading && !summary) return <LoadingPanel label="Loading admin summary..." />;
  if (!loading && error && !summary) {
    return <PageErrorState title="Failed to load admin summary" message={error} onRetry={onRetry} />;
  }
  if (!summary) return <PageErrorState title="Admin summary unavailable" message="No summary data returned." onRetry={onRetry} />;
  return (
    <>
      <section className="summary-grid">
        <KpiCard label="Revenue" value={`CNY ${summary.revenue.toFixed(0)}`} />
        <KpiCard label="Orders" value={summary.orders} />
        <KpiCard label="New Users" value={summary.new_users} />
        <KpiCard label="Low Stock Count" value={summary.low_stock_count} />
      </section>
      <section className="panel">
        <div className="section-title">
          <h3>7 Day Revenue Sparkline</h3>
          <div className="quick-actions">
            <button onClick={() => navigate("/admin/products")}>Add Product</button>
            <button className="ghost-button" onClick={() => navigate("/admin/orders")}>View Orders</button>
            <button className="ghost-button" onClick={() => navigate("/admin/users")}>Manage Users</button>
          </div>
        </div>
        <SparklineChart data={summary.sparkline} />
      </section>
    </>
  );
}

function AdminProductsPage({
  products,
  categories,
  productForm,
  setProductForm,
  editingProduct,
  setEditingProduct,
  onSaveProduct,
  categoryForm,
  setCategoryForm,
  onSaveCategory,
  loading,
  error,
  onRetry,
}) {
  if (loading && !products.length) return <LoadingPanel label="Loading product management..." />;
  if (!loading && error && !products.length) {
    return <PageErrorState title="Failed to load products" message={error} onRetry={onRetry} />;
  }
  function beginEdit(product) {
    setEditingProduct(product);
    setProductForm({
      category_id: product.category_id,
      name: product.name,
      brand: product.brand || "",
      description: product.description,
      price: product.price,
      stock_quantity: product.stock_quantity,
      image_url: product.image_url || "",
      tags: (product.tags_json || []).join(","),
      variants: product.variants?.length
        ? product.variants.map((variant) => ({
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            stock_quantity: variant.stock_quantity,
            image_url: variant.image_url,
          }))
        : DEFAULT_PRODUCT_FORM.variants,
    });
  }
  return (
    <div className="admin-grid">
      <section className="panel span-2">
        <div className="section-title">
          <h3>Product Management</h3>
          <span>{products.length} visible rows</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Brand</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category_name}</td>
                  <td>CNY {Number(product.price).toFixed(2)}</td>
                  <td>{product.stock_quantity}</td>
                  <td>{product.brand}</td>
                  <td><button className="ghost-button" onClick={() => beginEdit(product)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form className="panel" onSubmit={onSaveProduct}>
        <div className="section-title">
          <h3>{editingProduct ? "Edit Product" : "Add Product"}</h3>
          {editingProduct ? <button type="button" className="ghost-button" onClick={() => { setEditingProduct(null); setProductForm(DEFAULT_PRODUCT_FORM); }}>Reset</button> : null}
        </div>
        <div className="stack-list">
          <select value={productForm.category_id} onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))}>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} placeholder="Product name" />
          <input value={productForm.brand} onChange={(event) => setProductForm((current) => ({ ...current, brand: event.target.value }))} placeholder="Brand" />
          <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="Price" />
          <input value={productForm.stock_quantity} onChange={(event) => setProductForm((current) => ({ ...current, stock_quantity: event.target.value }))} placeholder="Stock" />
          <input value={productForm.tags} onChange={(event) => setProductForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags" />
          <input value={productForm.image_url} onChange={(event) => setProductForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="Image URL" />
          <div className="variant-table">
            {productForm.variants.map((variant, index) => (
              <div className="variant-row" key={`${index + 1}`}>
                <input value={variant.sku} onChange={(event) => updateVariant(setProductForm, index, "sku", event.target.value)} placeholder="SKU" />
                <input value={variant.color} onChange={(event) => updateVariant(setProductForm, index, "color", event.target.value)} placeholder="Color" />
                <input value={variant.size} onChange={(event) => updateVariant(setProductForm, index, "size", event.target.value)} placeholder="Size" />
                <input value={variant.stock_quantity} onChange={(event) => updateVariant(setProductForm, index, "stock_quantity", event.target.value)} placeholder="Stock" />
              </div>
            ))}
            <button type="button" className="ghost-button" onClick={() => setProductForm((current) => ({ ...current, variants: [...current.variants, { sku: "", color: "", size: "", stock_quantity: "", image_url: "" }] }))}>
              Add Variant
            </button>
          </div>
          <button type="submit">{editingProduct ? "Update Product" : "Create Product"}</button>
        </div>
      </form>
      <form className="panel" onSubmit={onSaveCategory}>
        <div className="section-title">
          <h3>Create Category</h3>
          <span>Nested category selector</span>
        </div>
        <div className="stack-list">
          <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Category name" />
          <select value={categoryForm.parent_id} onChange={(event) => setCategoryForm((current) => ({ ...current, parent_id: event.target.value }))}>
            <option value="">Top level</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <button type="submit">Save Category</button>
        </div>
      </form>
    </div>
  );
}

function AdminOrdersPage({ orders, stockouts, loading, error, onRetry }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  if (loading && !orders.length) return <LoadingPanel label="Loading orders..." />;
  if (!loading && error && !orders.length) {
    return <PageErrorState title="Failed to load orders" message={error} onRetry={onRetry} />;
  }
  return (
    <div className="admin-grid">
      <section className="panel span-2">
        <div className="section-title">
          <h3>Order Management</h3>
          <span>{orders.length} orders</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)}>
                  <td>#{order.id}</td>
                  <td>{order.customer.username}</td>
                  <td>{order.status}</td>
                  <td>CNY {order.total_amount.toFixed(2)}</td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h3>Top Stockout Risks</h3>
          <span>{stockouts.length} alerts</span>
        </div>
        <div className="stack-list">
          {stockouts.slice(0, 8).map((item) => (
            <div className="list-row" key={item.product_id}>
              <strong>{item.product_name}</strong>
              <span>{item.days_left} days</span>
            </div>
          ))}
        </div>
      </section>
      {selectedOrder ? (
        <Modal title={`Order #${selectedOrder.id}`} onClose={() => setSelectedOrder(null)}>
          <div className="stack-list">
            <div className="list-row"><strong>Customer</strong><span>{selectedOrder.customer.username}</span></div>
            <div className="list-row"><strong>Address</strong><span>{selectedOrder.shipping_address}</span></div>
            <div className="list-row"><strong>Payment</strong><span>{selectedOrder.payment.method}</span></div>
            {selectedOrder.items.map((item) => (
              <div key={`${selectedOrder.id}-${item.product_id}`} className="list-row">
                <span>{item.product_name}</span>
                <strong>{item.quantity}</strong>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AdminUsersPage({ users, selectedUser, suspicious, onOpenUser, loading, error, onRetry }) {
  if (loading && !users.length) return <LoadingPanel label="Loading users..." />;
  if (!loading && error && !users.length) {
    return <PageErrorState title="Failed to load users" message={error} onRetry={onRetry} />;
  }
  return (
    <div className="admin-grid">
      <section className="panel span-2">
        <div className="section-title">
          <h3>User Management</h3>
          <span>{users.length} customers</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Tier</th>
                <th>RFM</th>
                <th>LTV</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} onClick={() => onOpenUser(user.id)}>
                  <td>{user.username}</td>
                  <td>{user.membership_tier}</td>
                  <td><span className="segment-badge">{user.rfm_segment}</span></td>
                  <td>CNY {Number(user.ltv_prediction).toFixed(0)}</td>
                  <td>{user.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h3>Suspicious Activity</h3>
          <span>{suspicious.length} entries</span>
        </div>
        <div className="stack-list">
          {suspicious.slice(0, 12).map((entry) => (
            <div className="list-row" key={entry.id}>
              <div>
                <strong>{entry.reason}</strong>
                <p>{entry.ip_address}</p>
              </div>
              <span className={`risk-pill ${entry.risk_level}`}>{entry.risk_level}</span>
            </div>
          ))}
        </div>
      </section>
      {selectedUser ? (
        <Modal title={selectedUser.username} onClose={() => onOpenUser(null)}>
          <div className="stack-list">
            <div className="list-row"><strong>Email</strong><span>{selectedUser.email}</span></div>
            <div className="list-row"><strong>Tier</strong><span>{selectedUser.membership_tier}</span></div>
            <div className="section-title compact"><h4>Purchase History</h4></div>
            {selectedUser.purchase_history.map((order) => (
              <div className="list-row" key={order.id}>
                <div>
                  <strong>Order #{order.id}</strong>
                  <p>{order.items.join(", ")}</p>
                </div>
                <span>CNY {order.total_amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="section-title compact"><h4>Activity Log</h4></div>
            {selectedUser.activity_log.slice(0, 10).map((event, index) => (
              <div className="list-row" key={`${event.created_at}-${index}`}>
                <span>{event.event_type}</span>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AdminReportsPage({ dashboard, categoryPerformance, geography, rfm, cohorts, forecast, funnel, logs, inventoryAlerts, loading, error, onRetry }) {
  if (loading && !dashboard) return <LoadingPanel label="Loading reports..." />;
  if (!loading && error && !dashboard) {
    return <PageErrorState title="Failed to load reports" message={error} onRetry={onRetry} />;
  }
  return (
    <div className="admin-grid">
      <ChartPanel className="span-2" title="Sales Report">
        <SalesSummaryChart data={dashboard?.sales_trends || []} />
      </ChartPanel>
      <ChartPanel title="RFM Segments">
        <RfmPieChart data={rfm} />
      </ChartPanel>
      <ChartPanel title="Conversion Funnel">
        <FunnelBarChart data={funnel} />
      </ChartPanel>
      <ChartPanel className="span-2" title="Geography Report">
        <GeographyBarChart data={geography} />
      </ChartPanel>
      <ChartPanel title="Cohort Retention">
        <CohortHeatmap data={cohorts} />
      </ChartPanel>
      <ChartPanel title="Forecast">
        <ForecastLineChart data={forecast} />
      </ChartPanel>
      <section className="panel">
        <div className="section-title">
          <h3>Category Performance Table</h3>
          <span>{categoryPerformance.length} rows</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Revenue</th>
                <th>Margin</th>
                <th>Turnover</th>
              </tr>
            </thead>
            <tbody>
              {categoryPerformance.map((row) => (
                <tr key={row.category_name}>
                  <td>{row.category_name}</td>
                  <td>CNY {row.revenue.toFixed(2)}</td>
                  <td>CNY {row.margin.toFixed(2)}</td>
                  <td>{row.turnover_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h3>Logs & Inventory Alerts</h3>
          <span>{logs.length} logs</span>
        </div>
        <div className="stack-list">
          {inventoryAlerts.slice(0, 5).map((item) => (
            <div className="list-row" key={item.product_id}>
              <strong>{item.product_name}</strong>
              <span>{item.stock_quantity}</span>
            </div>
          ))}
          {logs.slice(0, 6).map((log) => (
            <div className="list-row" key={log.id}>
              <span>{log.event_type}</span>
              <small>{new Date(log.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductSection({ title, items, onOpen, onAdd }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h3>{title}</h3>
        <span>{items.length} items</span>
      </div>
      <div className="product-grid">
        {items.map((item) => (
          <ProductCard key={item.id || item.product_id} item={item} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

function categoryImageSlug(value) {
  return String(value || "generic")
    .split("/")[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "generic";
}

function resolveProductImage(item) {
  if (!item) return null;
  return item.thumbnail_url || item.image_url || item.image_urls?.[0] || null;
}

function StarRating({ value = 0 }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return <span className="rating-stars">{"*".repeat(rounded)}{".".repeat(5 - rounded)}</span>;
}

function ProductImage({ src, fallbackKey, alt, productId, className = "", containerClassName = "", showLabel = true }) {
  const categoryFallbackSrc = `https://picsum.photos/seed/fallback${productId || categoryImageSlug(fallbackKey)}/400/400`;
  const [currentSrc, setCurrentSrc] = useState(src || categoryFallbackSrc);
  const [loading, setLoading] = useState(Boolean(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || categoryFallbackSrc);
    setLoading(Boolean(src));
    setFailed(false);
  }, [src, categoryFallbackSrc]);

  function handleError() {
    if (currentSrc !== categoryFallbackSrc) {
      setCurrentSrc(categoryFallbackSrc);
      setLoading(true);
      return;
    }
    setFailed(true);
    setLoading(false);
  }

  return (
    <div className={`product-image-frame ${containerClassName}`.trim()}>
      {loading ? <div className="image-skeleton" /> : null}
      {!failed ? (
        <img
          src={currentSrc}
          alt={alt}
          className={`${className} ${loading ? "is-loading" : ""}`.trim()}
          loading="lazy"
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      ) : null}
      {failed ? (
        <div className="product-image-fallback" aria-hidden="true">
          <span className="product-image-icon">[]</span>
          {showLabel ? <span>{fallbackKey || "Product"}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationStrip({ title, items, onOpen, onAdd }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h3>{title}</h3>
        <span>{items.length} recommendations</span>
      </div>
      <div className="recommend-grid">
        {items.map((item) => (
          <article className="recommend-card" key={item.product_id}>
            <ProductImage
              src={resolveProductImage(item)}
              fallbackKey={item.category_name}
              alt={item.product_name}
              productId={item.product_id}
              className="product-image recommend-image"
              containerClassName="recommend-image-shell"
              showLabel={false}
            />
            <div>
              <strong>{item.product_name}</strong>
              <p>{item.category_name || item.reason}</p>
            </div>
            <div className="quick-actions">
              <button className="ghost-button" onClick={() => onOpen(item.product_id)}>Open</button>
              {onAdd ? <button onClick={() => onAdd({ id: item.product_id, name: item.product_name, price: item.score || 99, image_url: item.image_url, thumbnail_url: item.thumbnail_url, category_name: item.category_name }, null)}>Add</button> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductCard({ item, onOpen, onAdd }) {
  const productId = item.id || item.product_id;
  return (
    <article className="product-card">
      <ProductImage
        src={resolveProductImage(item)}
        fallbackKey={item.category_name}
        alt={item.name || item.product_name}
        productId={productId}
        className="product-image product-image-card"
        containerClassName="product-visual"
      />
      <span className="tag">{item.category_name || "Category"}</span>
      <h4>{item.name || item.product_name}</h4>
      <p>{item.description || "Recommendation generated from the seeded dataset and browsing behavior."}</p>
      <div className="product-meta">
        <StarRating value={item.rating_average} />
        <span>{item.review_count ? `${item.review_count} reviews` : "New listing"}</span>
      </div>
      <div className="list-row compact">
        <strong>CNY {Number(item.price || item.score || 0).toFixed(2)}</strong>
        {item.stock_quantity !== undefined ? <span>Stock {item.stock_quantity}</span> : null}
      </div>
      <div className="quick-actions">
        <button className="ghost-button" onClick={() => onOpen(productId)}>View</button>
        {onAdd ? <button onClick={() => onAdd(item)}>Add to Cart</button> : null}
      </div>
    </article>
  );
}

function LoadingPanel({ label, dark }) {
  return (
    <section className={dark ? "panel panel-dark loading-panel" : "panel loading-panel"}>
      <div className="skeleton-lines">
        <div className="skeleton-line large" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
      <p>{label}</p>
    </section>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartPanel({ title, children, className = "" }) {
  return (
    <section className={`panel panel-chart ${className}`.trim()}>
      <div className="section-title">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ChartCanvas({ option, dark = false, height = 280 }) {
  const ref = useRef(null);
  useEffect(() => {
    const chart = echarts.init(ref.current, null, { renderer: "canvas" });
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} className={dark ? "chart chart-dark" : "chart"} style={{ height }} />;
}

function SalesTrendChart({ data }) {
  const labels = data.map((item) => item.label);
  const today = data.map((item) => item.value);
  const yesterday = data.map((item) => Math.max(0, item.value - 1200));
  return (
    <ChartCanvas
      dark
      option={{
        color: ["#60a5fa", "#22c55e"],
        backgroundColor: "transparent",
        tooltip: { trigger: "axis" },
        legend: { data: ["Today", "Yesterday"], textStyle: { color: "#e2e8f0" } },
        xAxis: { type: "category", data: labels, axisLabel: { color: "#cbd5e1" } },
        yAxis: { type: "value", axisLabel: { color: "#cbd5e1" } },
        series: [
          { name: "Today", type: "line", smooth: true, areaStyle: {}, data: today },
          { name: "Yesterday", type: "line", smooth: true, data: yesterday },
        ],
      }}
    />
  );
}

function CategoryShareChart({ data }) {
  return (
    <ChartCanvas
      dark
      option={{
        color: ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8"],
        tooltip: { trigger: "item" },
        series: [
          {
            type: "pie",
            radius: ["42%", "72%"],
            data: data.slice(0, 8).map((item) => ({ name: item.category_name, value: item.revenue })),
            label: { color: "#e2e8f0" },
          },
        ],
      }}
    />
  );
}

function GeographyBarChart({ data }) {
  const rows = aggregateGeography(data).slice(0, 12);
  return (
    <ChartCanvas
      dark
      option={{
        color: ["#60a5fa"],
        tooltip: { trigger: "axis" },
        xAxis: { type: "value", axisLabel: { color: "#cbd5e1" } },
        yAxis: { type: "category", data: rows.map((item) => item.name), axisLabel: { color: "#cbd5e1" } },
        series: [{ type: "bar", data: rows.map((item) => item.value), itemStyle: { borderRadius: 8 } }],
      }}
    />
  );
}

function RfmRadarChart({ data }) {
  const maxValue = Math.max(...data.map((item) => item.users), 1);
  return (
    <ChartCanvas
      dark
      option={{
        radar: {
          indicator: data.slice(0, 6).map((item) => ({ name: item.segment, max: maxValue })),
          axisName: { color: "#e2e8f0" },
          splitLine: { lineStyle: { color: "rgba(226,232,240,0.2)" } },
        },
        series: [
          {
            type: "radar",
            data: [{ value: data.slice(0, 6).map((item) => item.users), areaStyle: { opacity: 0.28 } }],
          },
        ],
      }}
    />
  );
}

function CohortHeatmap({ data }) {
  const months = Array.from(new Set(data.flatMap((row) => Object.keys(row.retention || {})))).slice(0, 6);
  const source = data.slice(0, 8);
  const heatmapData = [];
  source.forEach((row, rowIndex) => {
    months.forEach((month, monthIndex) => {
      heatmapData.push([monthIndex, rowIndex, Number(row.retention[month] || 0)]);
    });
  });
  return (
    <ChartCanvas
      dark
      option={{
        grid: { left: 70, right: 10, top: 20, bottom: 40 },
        xAxis: { type: "category", data: months, axisLabel: { color: "#cbd5e1" } },
        yAxis: { type: "category", data: source.map((row) => row.cohort), axisLabel: { color: "#cbd5e1" } },
        visualMap: { min: 0, max: 100, calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#cbd5e1" } },
        series: [{ type: "heatmap", data: heatmapData, label: { show: true, color: "#0f172a" } }],
      }}
    />
  );
}

function ForecastAndAlerts({ forecast, stockouts }) {
  return (
    <div className="forecast-layout">
      <ForecastLineChart data={forecast} />
      <div className="stack-list">
        {stockouts.slice(0, 5).map((item) => (
          <div className="list-row" key={item.product_id}>
            <div>
              <strong>{item.product_name}</strong>
              <p>Potential stockout</p>
            </div>
            <span>{item.days_left}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForecastLineChart({ data }) {
  return (
    <ChartCanvas
      dark
      option={{
        color: ["#f59e0b"],
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: data.map((item) => item.label), axisLabel: { color: "#cbd5e1" } },
        yAxis: { type: "value", axisLabel: { color: "#cbd5e1" } },
        series: [{ type: "line", smooth: true, areaStyle: {}, data: data.map((item) => item.value) }],
      }}
    />
  );
}

function TickerList({ orders }) {
  return (
    <div className="ticker-list">
      {orders.map((order) => (
        <div className="ticker-row" key={order.id}>
          <div>
            <strong>{order.customer.username}</strong>
            <p>{order.items[0]?.product_name || "Order item"}</p>
          </div>
          <div className="ticker-meta">
            <strong>CNY {order.total_amount.toFixed(2)}</strong>
            <small>{new Date(order.created_at).toLocaleTimeString()}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function SparklineChart({ data }) {
  return (
    <ChartCanvas
      option={{
        color: ["#2563eb"],
        grid: { top: 12, right: 12, left: 18, bottom: 18 },
        xAxis: { type: "category", show: false, data: data.map((item) => item.label) },
        yAxis: { type: "value", show: false },
        series: [{ type: "line", smooth: true, areaStyle: {}, data: data.map((item) => item.value) }],
      }}
      height={180}
    />
  );
}

function SalesSummaryChart({ data }) {
  return (
    <ChartCanvas
      option={{
        color: ["#2563eb"],
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: data.map((item) => item.label) },
        yAxis: { type: "value" },
        series: [{ type: "line", smooth: true, data: data.map((item) => item.value), areaStyle: {} }],
      }}
      height={220}
    />
  );
}

function RfmPieChart({ data }) {
  return (
    <ChartCanvas
      option={{
        tooltip: { trigger: "item" },
        series: [{ type: "pie", radius: ["36%", "72%"], data: data.map((item) => ({ name: item.segment, value: item.users })) }],
      }}
      height={220}
    />
  );
}

function FunnelBarChart({ data }) {
  return (
    <ChartCanvas
      option={{
        color: ["#16a34a"],
        xAxis: { type: "category", data: data.map((item) => item.step) },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: data.map((item) => item.users), itemStyle: { borderRadius: 8 } }],
      }}
      height={220}
    />
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-title">
          <h3>{title}</h3>
          <button className="ghost-button" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function updateVariant(setProductForm, index, field, value) {
  setProductForm((current) => ({
    ...current,
    variants: current.variants.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, [field]: value } : variant
    ),
  }));
}

function aggregateGeography(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const current = grouped.get(row.province) || 0;
    grouped.set(row.province, current + Number(row.value || 0));
  });
  return [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function getTierProgress(tier) {
  return { bronze: 24, silver: 51, gold: 76, platinum: 100 }[String(tier || "").toLowerCase()] || 12;
}

function generateCaptchaSeed() {
  const first = Math.floor(Math.random() * 8) + 1;
  const second = Math.floor(Math.random() * 8) + 1;
  return { equation: `${first} + ${second} = ?`, answer: first + second };
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen();
  } else {
    void document.exitFullscreen();
  }
}

function Footer({ navigate }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <p className="eyebrow">Smart Commerce Analytics</p>
          <p>Premium dark-mode commerce intelligence for course submission and showcase screenshots.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <button className="footer-link" onClick={() => navigate("/")}>Homepage</button>
          <button className="footer-link" onClick={() => navigate("/search")}>Search</button>
        </div>
        <div>
          <h4>Platform</h4>
          <button className="footer-link" onClick={() => navigate("/dashboard")}>War Room</button>
          <button className="footer-link" onClick={() => navigate("/admin/reports")}>Reports</button>
        </div>
        <div>
          <h4>Connect</h4>
          <span className="footer-link static">GitHub</span>
          <span className="footer-link static">Course Demo</span>
        </div>
      </div>
    </footer>
  );
}
