# Requirements Analysis

## Business Scenario

Chinese e-commerce competition is driven by fast-moving promotions, fragmented traffic sources, and increasingly personalized shopping expectations. A conventional CRUD storefront does not give operations teams enough visibility into user journeys, stock risk, promotion lift, or recommendation performance. This capstone positions the platform as a compact but realistic monorepo that combines online shopping, operational controls, behavioral event collection, and analytics.

## Pain Points

| Pain Point | Impact | Proposed Capability |
| --- | --- | --- |
| Inventory mismanagement | Stockouts, overstock, delayed replenishment | Variant stock tracking, inventory logs, low-stock alerts, stockout prediction |
| Weak recommendation conversion | Low basket size and repeat purchase | Hybrid recommendations using collaborative, content, and business-rule strategies |
| Poor real-time visibility | Slow business reaction to spikes/anomalies | War-room dashboard, daily aggregates, anomaly alerts |
| Low-value user segmentation | Generic campaigns, poor retention | RFM segmentation, cohort retention, churn prediction, LTV estimation |
| Incomplete behavior data | Hard to analyze funnel leakage | Browse, cart, login, search, session, and operation logging |

## Architecture Option Comparison

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Monolith | Fast development, simple deployment, easy debugging, appropriate for single-developer academic scope | Lower long-term service isolation | Selected |
| Microservices | Clear service boundaries, independent scaling | Excessive ops overhead for course timeline | Rejected for scope |
| Serverless | Fast bootstrap, pay-per-use | Harder local simulation for analytics pipelines | Rejected for controllability |

## Functional Scope

- Customer registration, login, browsing, search, cart, checkout, order history, wishlist, reviews, coupons, recommendations
- Sales role for catalog, inventory, categories, and operational analytics
- Admin role for sales account control, monitoring, suspicious activity, and aggregation jobs
- Big-data-style event capture for login, browse, cart, purchase, search, and operations
- Analytics outputs for RFM, cohort, funnel, geography, trend, anomaly, stockout, churn, and recommendation metrics

## Technical Specification

| Layer | Selection |
| --- | --- |
| Backend | FastAPI + SQLAlchemy 2.0 + Pydantic 2 |
| Frontend | React + Vite |
| DB | SQLite local dev, PostgreSQL-ready schema |
| Cache | Redis-ready configuration |
| Analytics | Pandas, NumPy, scikit-learn |
| Visualization | Frontend-ready chart JSON, ECharts planned |
| Auth | JWT bearer token |
| Deployment | Docker Compose + Nginx reverse proxy |

## Four-Week Gantt Plan

```text
Week 1  [####] Auth stabilization, schema enrichment, seed design
Week 2  [####] Enhanced catalog/order/user modules, event capture, analytics services
Week 3  [####] Frontend dashboard, recommendation views, admin tooling
Week 4  [####] Testing, Docker deployment, documentation, performance tuning
```
