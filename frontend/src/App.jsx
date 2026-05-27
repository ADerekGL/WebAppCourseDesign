import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import * as echarts from "echarts/core";
import { apiFetch } from "./api";

const defaultLogin = { username: "customer_test", password: "password" };
const defaultRegister = { username: "", email: "", password: "" };
const defaultCheckout = { shipping_address: "", payment_method: "card", coupon_code: "" };
const chartThemes = ["#78a6ff", "#6fe1d2", "#ffca7a", "#ff8585", "#8a7dff", "#57c27a"];

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer
]);

export default function App() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash));
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("sca-auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [message, setMessage] = useState("");
  const [loginForm, setLoginForm] = useState(defaultLogin);
  const [registerForm, setRegisterForm] = useState(defaultRegister);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [trending, setTrending] = useState([]);
  const [heroRecommendations, setHeroRecommendations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductReviews, setSelectedProductReviews] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [filters, setFilters] = useState({ category_id: "", search: "", min_price: "", max_price: "", sort_by: "updated_at" });
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState(defaultCheckout);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [warRoom, setWarRoom] = useState(null);
  const [rfm, setRfm] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [logs, setLogs] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [stockouts, setStockouts] = useState([]);
  const [churn, setChurn] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [salesAccounts, setSalesAccounts] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "", description: "", parent_id: "" });
  const [newProduct, setNewProduct] = useState({
    category_id: "",
    name: "",
    brand: "",
    description: "",
    price: "",
    stock_quantity: "",
    tags_json: "trending,new-arrival",
    image_url: ""
  });

  const isCustomer = auth?.user.role === "customer";
  const isStaff = auth?.user.role === "sales" || auth?.user.role === "admin";
  const isAdmin = auth?.user.role === "admin";

  useEffect(() => {
    const onHashChange = () => setRoute(normalizeRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#/";
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
  }, [filters]);

  useEffect(() => {
    if (!auth) {
      localStorage.removeItem("sca-auth");
      setOrders([]);
      setProfile(null);
      setDashboard(null);
      setWarRoom(null);
      setSalesAccounts([]);
      return;
    }
    localStorage.setItem("sca-auth", JSON.stringify(auth));
    if (isCustomer) {
      void Promise.all([loadOrders(auth.access_token), loadPersonalized(auth.access_token)]);
    }
    if (isStaff) {
      void loadStaffData(auth.access_token, auth.user.role);
    }
  }, [auth, isCustomer, isStaff]);

  async function loadPublicData() {
    const query = new URLSearchParams();
    if (filters.category_id) query.set("category_id", filters.category_id);
    if (filters.search) query.set("search", filters.search);
    if (filters.min_price) query.set("min_price", filters.min_price);
    if (filters.max_price) query.set("max_price", filters.max_price);
    if (filters.sort_by) query.set("sort_by", filters.sort_by);

    const [productData, categoryData, trendingData] = await Promise.all([
      apiFetch(`/products?${query.toString()}`),
      apiFetch("/products/categories"),
      apiFetch("/api/recommendations/trending")
    ]).catch((error) => {
      setMessage(error.message);
      return [[], [], []];
    });
    setCatalog(productData || []);
    setCategories(categoryData || []);
    setTrending(trendingData || []);
  }

  async function loadOrders(token) {
    try {
      const data = await apiFetch("/orders/history", {}, token);
      setOrders(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadPersonalized(token) {
    try {
      const [personalized, history] = await Promise.all([
        apiFetch("/api/recommendations/personalized", {}, token),
        apiFetch("/orders/history", {}, token)
      ]);
      setHeroRecommendations(personalized);
      setRecommendations(personalized);
      const latestOrder = history[0];
      if (latestOrder) {
        const profileData = {
          membership_tier: auth?.user?.membership_tier || "bronze",
          order_count: history.length,
          total_spent: history.reduce((sum, order) => sum + order.total_amount, 0),
          latest_status: latestOrder.status
        };
        setProfile(profileData);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadStaffData(token, role) {
    try {
      const requests = [
        apiFetch("/analytics/dashboard", {}, token),
        apiFetch("/analytics/dashboard/war-room", {}, token),
        apiFetch("/analytics/rfm", {}, token),
        apiFetch("/analytics/cohorts", {}, token),
        apiFetch("/analytics/funnel", {}, token),
        apiFetch("/analytics/logs", {}, token),
        apiFetch("/analytics/inventory-alerts", {}, token),
        apiFetch("/analytics/stockout-predictions", {}, token),
        apiFetch("/analytics/churn-predictions", {}, token),
        apiFetch("/analytics/recommendation-metrics", {}, token)
      ];
      if (role === "admin") {
        requests.push(apiFetch("/admin/sales-accounts", {}, token));
      }
      const [
        dashboardData,
        warRoomData,
        rfmData,
        cohortData,
        funnelData,
        logData,
        inventoryData,
        stockoutData,
        churnData,
        metricsData,
        salesData = []
      ] = await Promise.all(requests);
      setDashboard(dashboardData);
      setWarRoom(warRoomData);
      setRfm(rfmData);
      setCohorts(cohortData);
      setFunnel(funnelData);
      setLogs(logData);
      setInventoryAlerts(inventoryData);
      setStockouts(stockoutData);
      setChurn(churnData);
      setMetrics(metricsData);
      setSalesAccounts(salesData);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function openProduct(productId) {
    try {
      const [product, productRecommendations, reviewData] = await Promise.all([
        apiFetch(`/products/${productId}`),
        apiFetch(`/api/recommendations/frequently-bought-together/${productId}`),
        apiFetch(`/products/${productId}/reviews`)
      ]);
      setSelectedProduct(product);
      setSelectedProductReviews(reviewData);
      setRecommendations(productRecommendations);
      window.location.hash = `#/product/${productId}`;
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const token = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(loginForm) });
      setAuth(token);
      setMessage(`Logged in as ${token.user.role}`);
      window.location.hash = token.user.role === "customer" ? "#/" : "#/dashboard";
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(registerForm) });
      setRegisterForm(defaultRegister);
      setMessage("Registration complete. Use the same credentials to log in.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    setAuth(null);
    setRoute("/");
    window.location.hash = "#/";
    setMessage("Logged out");
  }

  function addToCart(product, variantId = null) {
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id && item.variant_id === variantId);
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id && item.variant_id === variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          variant_id: variantId,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price
        }
      ];
    });
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (!auth) return;
    try {
      await apiFetch(
        "/orders/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            ...checkout,
            items: cart.map(({ product_id, quantity, variant_id }) => ({ product_id, quantity, variant_id }))
          })
        },
        auth.access_token
      );
      setCart([]);
      setCheckout(defaultCheckout);
      setMessage("Checkout completed.");
      await Promise.all([loadOrders(auth.access_token), loadPublicData(), loadPersonalized(auth.access_token)]);
      window.location.hash = "#/account";
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createCategory(event) {
    event.preventDefault();
    try {
      await apiFetch(
        "/products/categories",
        {
          method: "POST",
          body: JSON.stringify({
            ...newCategory,
            parent_id: newCategory.parent_id ? Number(newCategory.parent_id) : null
          })
        },
        auth.access_token
      );
      setNewCategory({ name: "", description: "", parent_id: "" });
      setMessage("Category created.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    try {
      await apiFetch(
        "/products",
        {
          method: "POST",
          body: JSON.stringify({
            category_id: Number(newProduct.category_id),
            name: newProduct.name,
            brand: newProduct.brand,
            description: newProduct.description,
            price: Number(newProduct.price),
            stock_quantity: Number(newProduct.stock_quantity),
            image_url: newProduct.image_url,
            tags_json: newProduct.tags_json.split(",").map((item) => item.trim()).filter(Boolean),
            variants: [
              {
                sku: `${newProduct.name.replace(/\s+/g, "-").toUpperCase()}-STD`,
                color: "Standard",
                size: "One Size",
                stock_quantity: Number(newProduct.stock_quantity),
                image_url: newProduct.image_url,
                is_default: true
              }
            ]
          })
        },
        auth.access_token
      );
      setNewProduct({
        category_id: "",
        name: "",
        brand: "",
        description: "",
        price: "",
        stock_quantity: "",
        tags_json: "trending,new-arrival",
        image_url: ""
      });
      setMessage("Product created.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const customerRoutes = useMemo(
    () => [
      { key: "/", label: "Home" },
      { key: "/catalog", label: "Catalog" },
      { key: "/checkout", label: `Cart (${cart.length})` },
      { key: "/account", label: "User Center" }
    ],
    [cart.length]
  );

  const staffRoutes = [
    { key: "/dashboard", label: "War Room" },
    { key: "/reports", label: "Reports" },
    { key: "/manage", label: "Management" }
  ];

  return (
    <div className={`shell ${route === "/dashboard" ? "shell-dashboard" : ""}`}>
      <TopBar
        auth={auth}
        route={route}
        customerRoutes={customerRoutes}
        staffRoutes={staffRoutes}
        onNavigate={(next) => {
          window.location.hash = `#${next}`;
        }}
        onLogout={logout}
      />

      {message ? <div className="toast">{message}</div> : null}

      {!auth ? (
        <PublicLanding
          loginForm={loginForm}
          registerForm={registerForm}
          onLoginChange={setLoginForm}
          onRegisterChange={setRegisterForm}
          onLogin={handleLogin}
          onRegister={handleRegister}
          trending={trending}
          recommendations={heroRecommendations}
          onProductOpen={openProduct}
        />
      ) : null}

      {auth && isCustomer ? (
        <div className="page-grid">
          <aside className="sidebar">
            <CategoryRail categories={categories} filters={filters} setFilters={setFilters} />
            <CartPanel cart={cart} checkout={checkout} setCheckout={setCheckout} onSubmit={submitCheckout} />
          </aside>
          <main className="content">
            {route === "/" ? (
              <CustomerHome
                catalog={catalog.slice(0, 8)}
                recommendations={heroRecommendations}
                trending={trending}
                orders={orders}
                onProductOpen={openProduct}
                onAddToCart={addToCart}
              />
            ) : null}
            {route === "/catalog" ? (
              <CatalogView
                catalog={catalog}
                filters={filters}
                setFilters={setFilters}
                onProductOpen={openProduct}
                onAddToCart={addToCart}
              />
            ) : null}
            {route.startsWith("/product/") && selectedProduct ? (
              <ProductDetailView
                product={selectedProduct}
                reviews={selectedProductReviews}
                recommendations={recommendations}
                onAddToCart={addToCart}
                onBack={() => {
                  window.location.hash = "#/catalog";
                }}
              />
            ) : null}
            {route === "/checkout" ? (
              <CheckoutView cart={cart} checkout={checkout} setCheckout={setCheckout} onSubmit={submitCheckout} />
            ) : null}
            {route === "/account" ? (
              <UserCenter profile={profile} orders={orders} recommendations={heroRecommendations} />
            ) : null}
          </main>
        </div>
      ) : null}

      {auth && isStaff ? (
        <div className={route === "/dashboard" ? "dashboard-layout" : "staff-layout"}>
          {route === "/dashboard" ? <WarRoomView warRoom={warRoom} /> : null}
          {route === "/reports" ? (
            <ReportsView
              dashboard={dashboard}
              rfm={rfm}
              cohorts={cohorts}
              funnel={funnel}
              inventoryAlerts={inventoryAlerts}
              stockouts={stockouts}
              churn={churn}
              metrics={metrics}
            />
          ) : null}
          {route === "/manage" ? (
            <ManagementView
              categories={categories}
              newCategory={newCategory}
              setNewCategory={setNewCategory}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              createCategory={createCategory}
              createProduct={createProduct}
              logs={logs}
              salesAccounts={salesAccounts}
              isAdmin={isAdmin}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function normalizeRoute(hash) {
  if (!hash || hash === "#") return "/";
  const route = hash.replace(/^#/, "");
  return route || "/";
}

function TopBar({ auth, route, customerRoutes, staffRoutes, onNavigate, onLogout }) {
  const items = !auth ? [] : auth.user.role === "customer" ? customerRoutes : staffRoutes;
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Smart Commerce Analytics Platform</p>
        <h1>E-Commerce Analytics Command Center</h1>
      </div>
      <nav className="nav-tabs">
        {items.map((item) => (
          <button
            key={item.key}
            className={route === item.key || route.startsWith(`${item.key}/`) ? "tab active" : "tab"}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="identity">
        {auth ? (
          <>
            <span>{auth.user.username}</span>
            <span className="identity-role">{auth.user.role}</span>
            <button className="ghost" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <span>Guest browsing enabled</span>
        )}
      </div>
    </header>
  );
}

function PublicLanding({ loginForm, registerForm, onLoginChange, onRegisterChange, onLogin, onRegister, trending, recommendations, onProductOpen }) {
  return (
    <main className="landing">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="badge">Capstone-ready commerce analytics</p>
          <h2>Browse as a customer, monitor as sales, manage as admin.</h2>
          <p>
            The platform combines role-based e-commerce workflows, big-data event capture, analytics dashboards,
            recommendation services, and realistic seed data in one browser-friendly academic stack.
          </p>
        </div>
        <div className="auth-grid">
          <form className="panel stack" onSubmit={onLogin}>
            <h3>Login</h3>
            <input value={loginForm.username} onChange={(e) => onLoginChange({ ...loginForm, username: e.target.value })} placeholder="Username" />
            <input type="password" value={loginForm.password} onChange={(e) => onLoginChange({ ...loginForm, password: e.target.value })} placeholder="Password" />
            <button type="submit">Enter Platform</button>
          </form>
          <form className="panel stack" onSubmit={onRegister}>
            <h3>Customer Register</h3>
            <input value={registerForm.username} onChange={(e) => onRegisterChange({ ...registerForm, username: e.target.value })} placeholder="Username" />
            <input value={registerForm.email} onChange={(e) => onRegisterChange({ ...registerForm, email: e.target.value })} placeholder="Email" />
            <input type="password" value={registerForm.password} onChange={(e) => onRegisterChange({ ...registerForm, password: e.target.value })} placeholder="Password" />
            <button type="submit">Create Account</button>
          </form>
        </div>
      </section>

      <section className="showcase-grid">
        <RecommendationPanel title="Trending Right Now" items={trending} onOpen={onProductOpen} />
        <RecommendationPanel title="Preview Recommendations" items={recommendations} onOpen={onProductOpen} />
      </section>
    </main>
  );
}

function CategoryRail({ categories, filters, setFilters }) {
  return (
    <section className="panel stack">
      <div className="section-head">
        <h3>Category Explorer</h3>
        <span>{categories.length} nodes</span>
      </div>
      <div className="category-list">
        <button className={!filters.category_id ? "category-pill active" : "category-pill"} onClick={() => setFilters({ ...filters, category_id: "" })}>
          All Categories
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            className={String(filters.category_id) === String(category.id) ? "category-pill active" : "category-pill"}
            onClick={() => setFilters({ ...filters, category_id: category.id })}
          >
            {category.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function CustomerHome({ catalog, recommendations, trending, orders, onProductOpen, onAddToCart }) {
  return (
    <>
      <section className="headline-card">
        <div>
          <p className="eyebrow">Customer Experience</p>
          <h2>Personalized storefront with recommendations, trending demand, and order visibility.</h2>
        </div>
        <div className="kpi-strip">
          <MetricCard label="Recent Orders" value={orders.length} />
          <MetricCard label="Recommended" value={recommendations.length} />
          <MetricCard label="Trending SKUs" value={trending.length} />
        </div>
      </section>
      <RecommendationPanel title="Picked For You" items={recommendations} onOpen={onProductOpen} onAdd={onAddToCart} />
      <RecommendationPanel title="Frequently Moving Products" items={trending} onOpen={onProductOpen} onAdd={onAddToCart} />
      <CatalogCards title="New Arrivals Snapshot" items={catalog} onProductOpen={onProductOpen} onAddToCart={onAddToCart} />
    </>
  );
}

function CatalogView({ catalog, filters, setFilters, onProductOpen, onAddToCart }) {
  return (
    <>
      <section className="panel">
        <div className="toolbar">
          <h2>Catalog Search</h2>
          <div className="filter-row">
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search name, description, brand" />
            <input value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} placeholder="Min price" />
            <input value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} placeholder="Max price" />
            <select value={filters.sort_by} onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}>
              <option value="updated_at">Newest</option>
              <option value="price">Price</option>
              <option value="stock_quantity">Stock</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </section>
      <CatalogCards title="Search Results" items={catalog} onProductOpen={onProductOpen} onAddToCart={onAddToCart} />
    </>
  );
}

function CatalogCards({ title, items, onProductOpen, onAddToCart }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
        <span>{items.length} items</span>
      </div>
      <div className="catalog-grid">
        {items.map((product) => (
          <article className="product-card" key={product.id}>
            <div className="product-cover" />
            <span className="tag">{product.category_name}</span>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <div className="meta-line">
              <strong>¥{Number(product.price).toFixed(2)}</strong>
              <span>Stock {product.stock_quantity}</span>
            </div>
            <div className="meta-line">
              <span>{product.brand || "General"}</span>
              <span>{product.review_count} reviews</span>
            </div>
            <div className="action-row">
              <button className="ghost" onClick={() => onProductOpen(product.id)}>Details</button>
              <button onClick={() => onAddToCart(product)}>Add to Cart</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductDetailView({ product, reviews, recommendations, onAddToCart, onBack }) {
  const defaultVariant = product.variants?.find((variant) => variant.is_default) || product.variants?.[0];
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant?.id || null);

  return (
    <>
      <section className="panel">
        <div className="toolbar">
          <button className="ghost" onClick={onBack}>Back</button>
          <span>{product.category_name}</span>
        </div>
        <div className="detail-layout">
          <div className="detail-gallery">
            <div className="detail-image" />
            <div className="thumb-row">
              {(product.variants || []).slice(0, 4).map((variant) => (
                <button
                  key={variant.id}
                  className={selectedVariant === variant.id ? "thumb active" : "thumb"}
                  onClick={() => setSelectedVariant(variant.id)}
                >
                  {variant.color || "Default"}
                </button>
              ))}
            </div>
          </div>
          <div className="detail-copy">
            <h2>{product.name}</h2>
            <p>{product.description}</p>
            <div className="metric-inline">
              <span>Brand: {product.brand || "Generic"}</span>
              <span>Rating: {product.rating_average || 0}</span>
              <span>Reviews: {product.review_count}</span>
            </div>
            <div className="metric-inline">
              <span>Stock: {product.stock_quantity}</span>
              <span>SKU: {product.sku || "n/a"}</span>
            </div>
            <div className="variant-list">
              {(product.variants || []).map((variant) => (
                <button
                  key={variant.id}
                  className={selectedVariant === variant.id ? "variant-pill active" : "variant-pill"}
                  onClick={() => setSelectedVariant(variant.id)}
                >
                  {variant.color} / {variant.size}
                </button>
              ))}
            </div>
            <div className="action-row">
              <button onClick={() => onAddToCart(product, selectedVariant)}>Add Variant to Cart</button>
            </div>
          </div>
        </div>
      </section>
      <RecommendationPanel title="Frequently Bought Together" items={recommendations} />
      <section className="panel">
        <div className="section-head">
          <h2>Review Summary</h2>
          <span>{reviews.length} records</span>
        </div>
        <div className="review-list">
          {reviews.slice(0, 6).map((review) => (
            <article className="review-card" key={review.id}>
              <div className="meta-line">
                <strong>{review.user_name}</strong>
                <span>{review.rating}/5</span>
              </div>
              <p>{review.title}</p>
              <small>{review.content}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function CartPanel({ cart, checkout, setCheckout, onSubmit }) {
  const total = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  return (
    <section className="panel stack">
      <div className="section-head">
        <h3>Cart Snapshot</h3>
        <span>{cart.length} lines</span>
      </div>
      <div className="stack">
        {cart.length === 0 ? <p className="muted">Add products from the catalog to begin checkout.</p> : null}
        {cart.map((item) => (
          <div key={`${item.product_id}-${item.variant_id || "base"}`} className="line-item">
            <span>{item.product_name}</span>
            <span>{item.quantity} x ¥{item.unit_price.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="line-item total-line">
        <strong>Total</strong>
        <strong>¥{total.toFixed(2)}</strong>
      </div>
      <form className="stack" onSubmit={onSubmit}>
        <textarea value={checkout.shipping_address} onChange={(e) => setCheckout({ ...checkout, shipping_address: e.target.value })} placeholder="Shipping address" />
        <select value={checkout.payment_method} onChange={(e) => setCheckout({ ...checkout, payment_method: e.target.value })}>
          <option value="card">Card</option>
          <option value="alipay">Alipay</option>
          <option value="wechat">WeChat</option>
        </select>
        <input value={checkout.coupon_code} onChange={(e) => setCheckout({ ...checkout, coupon_code: e.target.value })} placeholder="Coupon code" />
        <button type="submit" disabled={cart.length === 0}>Checkout</button>
      </form>
    </section>
  );
}

function CheckoutView({ cart, checkout, setCheckout, onSubmit }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Checkout Flow</h2>
        <span>Cart → Shipping → Payment → Confirm</span>
      </div>
      <div className="checkout-grid">
        <CartPanel cart={cart} checkout={checkout} setCheckout={setCheckout} onSubmit={onSubmit} />
        <div className="panel stack nested-panel">
          <h3>Order Summary</h3>
          {cart.map((item) => (
            <div className="line-item" key={`${item.product_id}-${item.variant_id || "base"}`}>
              <span>{item.product_name}</span>
              <span>{item.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UserCenter({ profile, orders, recommendations }) {
  return (
    <>
      <section className="headline-card">
        <div>
          <p className="eyebrow">User Center</p>
          <h2>Membership, order timeline, and recommendation retention surface.</h2>
        </div>
        <div className="kpi-strip">
          <MetricCard label="Tier" value={(profile?.membership_tier || "bronze").toUpperCase()} />
          <MetricCard label="Orders" value={profile?.order_count || 0} />
          <MetricCard label="Spend" value={`¥${Number(profile?.total_spent || 0).toFixed(0)}`} />
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>Order History</h2>
          <span>{orders.length} orders</span>
        </div>
        <div className="timeline-list">
          {orders.slice(0, 12).map((order) => (
            <article key={order.id} className="timeline-card">
              <div className="meta-line">
                <strong>Order #{order.id}</strong>
                <span>{order.status}</span>
              </div>
              <div className="meta-line">
                <span>¥{order.total_amount.toFixed(2)}</span>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
              <div className="timeline-mini">
                {order.timeline?.map((step) => (
                  <span key={`${order.id}-${step.status}`}>{step.status}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <RecommendationPanel title="Keep Exploring" items={recommendations} />
    </>
  );
}

function ReportsView({ dashboard, rfm, cohorts, funnel, inventoryAlerts, stockouts, churn, metrics }) {
  return (
    <div className="report-grid">
      <section className="panel">
        <h2>Executive Snapshot</h2>
        <div className="kpi-strip">
          <MetricCard label="Top Products" value={dashboard?.top_products?.length || 0} />
          <MetricCard label="RFM Segments" value={rfm.length} />
          <MetricCard label="Coverage" value={`${metrics?.coverage || 0}%`} />
        </div>
        <div className="mini-grid">
          <SimpleList title="Anomalies" items={dashboard?.anomaly_alerts || []} />
          <SimpleList title="Funnel" items={(funnel || []).map((item) => `${item.step}: ${item.users}`)} />
        </div>
      </section>
      <section className="panel">
        <h2>RFM Distribution</h2>
        <div className="stack">
          {rfm.map((segment) => (
            <div className="line-item" key={segment.segment}>
              <span>{segment.segment}</span>
              <span>{segment.users} users / ¥{segment.revenue.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Cohort Retention</h2>
        <div className="cohort-grid">
          {cohorts.slice(0, 8).map((row) => (
            <div className="cohort-row" key={row.cohort}>
              <strong>{row.cohort}</strong>
              <span>{Object.values(row.retention).slice(0, 4).join(" / ")}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Inventory and Risk</h2>
        <div className="mini-grid">
          <SimpleList title="Inventory Alerts" items={inventoryAlerts.slice(0, 6).map((item) => `${item.product_name}: ${item.stock_quantity}`)} />
          <SimpleList title="Stockout Predictions" items={stockouts.slice(0, 6).map((item) => `${item.product_name}: ${item.days_left}d`)} />
          <SimpleList title="Churn Predictions" items={churn.slice(0, 6).map((item) => `${item.username}: ${item.days_since_purchase}d`)} />
        </div>
      </section>
    </div>
  );
}

function ManagementView({ categories, newCategory, setNewCategory, newProduct, setNewProduct, createCategory, createProduct, logs, salesAccounts, isAdmin }) {
  return (
    <div className="report-grid">
      <section className="panel">
        <h2>Category Management</h2>
        <form className="stack" onSubmit={createCategory}>
          <input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} placeholder="Category name" />
          <select value={newCategory.parent_id} onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}>
            <option value="">Top level</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <textarea value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} placeholder="Description" />
          <button type="submit">Create Category</button>
        </form>
      </section>
      <section className="panel">
        <h2>Product Management</h2>
        <form className="stack" onSubmit={createProduct}>
          <select value={newProduct.category_id} onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}>
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Product name" />
          <input value={newProduct.brand} onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })} placeholder="Brand" />
          <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Description" />
          <input value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Price" />
          <input value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })} placeholder="Stock quantity" />
          <input value={newProduct.tags_json} onChange={(e) => setNewProduct({ ...newProduct, tags_json: e.target.value })} placeholder="Tags comma separated" />
          <input value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} placeholder="Image URL" />
          <button type="submit">Create Product</button>
        </form>
      </section>
      <section className="panel">
        <h2>System Logs</h2>
        <div className="stack">
          {logs.slice(0, 10).map((log) => (
            <div className="line-item" key={log.id}>
              <span>{log.event_type} / {log.account}</span>
              <span>{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
      {isAdmin ? (
        <section className="panel">
          <h2>Sales Accounts</h2>
          <div className="stack">
            {salesAccounts.map((account) => (
              <div className="line-item" key={account.id}>
                <span>{account.username}</span>
                <span>{account.email}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RecommendationPanel({ title, items, onOpen, onAdd }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
        <span>{items.length} items</span>
      </div>
      <div className="recommend-grid">
        {items.map((item) => (
          <article key={item.product_id} className="recommend-card">
            <div className="meta-line">
              <strong>{item.product_name}</strong>
              <span>{item.reason}</span>
            </div>
            <p>{item.category_name || "General merchandise"}</p>
            <div className="action-row">
              {onOpen ? <button className="ghost" onClick={() => onOpen(item.product_id)}>Open</button> : null}
              {onAdd ? <button onClick={() => onAdd({ id: item.product_id, name: item.product_name, price: item.score * 20 })}>Quick Add</button> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleList({ title, items }) {
  return (
    <div className="subpanel">
      <h3>{title}</h3>
      <div className="stack">
        {items.slice(0, 8).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function WarRoomView({ warRoom }) {
  const trendRef = useRef(null);
  const categoryRef = useRef(null);
  const geoRef = useRef(null);
  const rfmRef = useRef(null);

  useChart(trendRef, () => {
    if (!warRoom) return null;
    return {
      backgroundColor: "transparent",
      color: chartThemes,
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: warRoom.trend_today_vs_yesterday.map((item) => item.label), axisLabel: { color: "#8ea1c1" } },
      yAxis: { type: "value", axisLabel: { color: "#8ea1c1" } },
      series: [{ type: "line", smooth: true, data: warRoom.trend_today_vs_yesterday.map((item) => item.value), areaStyle: {} }]
    };
  }, [warRoom]);

  useChart(categoryRef, () => {
    if (!warRoom) return null;
    return {
      backgroundColor: "transparent",
      color: chartThemes,
      tooltip: { trigger: "item" },
      series: [{ type: "pie", radius: ["42%", "72%"], data: warRoom.category_pie.map((item) => ({ name: item.label, value: item.value })) }]
    };
  }, [warRoom]);

  useChart(geoRef, () => {
    if (!warRoom) return null;
    return {
      backgroundColor: "transparent",
      color: chartThemes,
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: warRoom.geography.slice(0, 10).map((item) => item.city), axisLabel: { color: "#8ea1c1", rotate: 25 } },
      yAxis: { type: "value", axisLabel: { color: "#8ea1c1" } },
      series: [{ type: "bar", data: warRoom.geography.slice(0, 10).map((item) => item.value), itemStyle: { borderRadius: 8 } }]
    };
  }, [warRoom]);

  useChart(rfmRef, () => {
    if (!warRoom) return null;
    return {
      backgroundColor: "transparent",
      color: chartThemes,
      radar: {
        indicator: warRoom.rfm_distribution.slice(0, 6).map((item) => ({ name: item.segment, max: Math.max(...warRoom.rfm_distribution.map((entry) => entry.users), 1) })),
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
        splitArea: { areaStyle: { color: ["transparent"] } },
        axisName: { color: "#cad5ef" }
      },
      series: [{ type: "radar", data: [{ value: warRoom.rfm_distribution.slice(0, 6).map((item) => item.users), areaStyle: { opacity: 0.28 } }] }]
    };
  }, [warRoom]);

  if (!warRoom) {
    return <section className="dashboard-empty">Loading dashboard...</section>;
  }

  return (
    <div className="warroom">
      <section className="warroom-top">
        <MetricCard label="GMV Today" value={`¥${warRoom.kpis.gmv_today.toFixed(0)}`} />
        <MetricCard label="Active Users Now" value={warRoom.kpis.active_users_now} />
        <MetricCard label="Orders Today" value={warRoom.kpis.orders_today} />
        <MetricCard label="Alerts" value={warRoom.kpis.alerts_count} />
      </section>
      <section className="warroom-grid">
        <div className="dashboard-card tall">
          <div className="card-title">Revenue Delta by Hour</div>
          <div className="chart" ref={trendRef} />
        </div>
        <div className="dashboard-card">
          <div className="card-title">Category Revenue Mix</div>
          <div className="chart" ref={categoryRef} />
        </div>
        <div className="dashboard-card">
          <div className="card-title">City Sales Heat Snapshot</div>
          <div className="chart" ref={geoRef} />
        </div>
        <div className="dashboard-card">
          <div className="card-title">RFM Radar</div>
          <div className="chart" ref={rfmRef} />
        </div>
        <div className="dashboard-card">
          <div className="card-title">Live Transactions</div>
          <div className="scroll-list">
            {warRoom.transactions.slice(0, 10).map((transaction) => (
              <div className="ticker-row" key={transaction.order_id}>
                <span>{transaction.username}</span>
                <strong>¥{transaction.amount.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-title">Inventory Alerts</div>
          <div className="scroll-list">
            {warRoom.inventory_alerts.slice(0, 10).map((alert) => (
              <div className="ticker-row" key={alert.product_id}>
                <span>{alert.product_name}</span>
                <strong>{alert.stock_quantity}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function useChart(ref, optionFactory, deps) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const chart = echarts.init(element);
    const option = optionFactory();
    if (option) chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, deps);
}
