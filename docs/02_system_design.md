# System Design

## Architecture Diagram

```mermaid
flowchart LR
    Browser[React Frontend] --> Nginx[Nginx Reverse Proxy]
    Nginx --> API[FastAPI Backend]
    API --> DB[(PostgreSQL / SQLite)]
    API --> Redis[(Redis Cache)]
    API --> Analytics[Pandas / NumPy / sklearn Services]
    API --> Jobs[Aggregation & Recommendation Jobs]
    Jobs --> DB
    API --> Docs[Export / Reports]
```

## Big Data Flow

```mermaid
flowchart LR
    Events[Login Browse Cart Search Purchase Ops] --> Collect[FastAPI Routers]
    Collect --> Store[EventLog / SearchLog / Order Tables]
    Store --> Aggregate[DailyStat + HotSearch + Recommendation Cache Jobs]
    Aggregate --> Analyze[RFM / Cohort / Funnel / Forecast / Churn]
    Analyze --> Visualize[Dashboard APIs / Frontend Charts]
```

## ER Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    USERS ||--o{ USER_ADDRESSES : has
    USERS ||--o{ USER_BEHAVIOR_SESSIONS : starts
    USERS ||--o{ PRODUCT_REVIEWS : writes
    USERS ||--o{ WISHLIST_ITEMS : saves
    USERS ||--o{ USER_COUPONS : owns
    CATEGORIES ||--o{ PRODUCTS : groups
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCTS ||--o{ PRODUCT_REVIEWS : receives
    PRODUCTS ||--o{ INVENTORY_LOGS : tracks
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ ORDER_TIMELINES : records
    ORDERS ||--o{ PAYMENT_RECORDS : pays
    ORDERS ||--o{ SHIPPING_TRACKING : ships
    COUPONS ||--o{ USER_COUPONS : assigned
```

## API Design Highlights

| Module | Example Endpoints |
| --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/password-reset` |
| Products | `/products`, `/products/{id}`, `/products/{id}/reviews`, `/products/categories` |
| Orders | `/orders/checkout`, `/orders/history` |
| Analytics | `/analytics/dashboard`, `/analytics/rfm`, `/analytics/cohorts`, `/analytics/funnel` |
| Recommendations | `/api/recommendations/personalized`, `/api/recommendations/trending` |
| Admin | `/admin/sales-accounts`, `/analytics/jobs/daily-stats` |

## Key Design Decisions

- Additive schema evolution for SQLite local development using lightweight column migrations
- Rich synthetic data to emulate business behavior before real deployment traffic exists
- Analytics computed primarily from transactional and event tables to preserve traceability
- Recommendation cache table to simulate nightly offline computation

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Scope creep | High | High | Stage delivery: backend domain first, UI second, docs third |
| Deployment failure | Medium | High | Docker Compose baseline and Aliyun deployment checklist |
| Data inconsistency | Medium | High | Transactional order writes, audit logs, aggregation refresh jobs |
| Performance bottleneck | Medium | Medium | Daily stats cache, recommendation cache, pagination-ready APIs |
| Security vulnerability | Medium | High | JWT auth, role guards, ORM usage, suspicious activity logging |
