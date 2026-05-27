# System Design Report

## 1. Architecture

The system follows a layered architecture:

```text
React Frontend
    |
REST API
    |
FastAPI Routers
    |
Service Layer
    |
SQLAlchemy ORM
    |
PostgreSQL / SQLite(dev)
```

Redis is reserved for caching sessions, hot analytics results, and rate-limiting counters.

## 2. Main Modules

- Auth Module
- Product & Category Module
- Order Module
- Event Logging Module
- Analytics Module
- Recommendation Module
- Admin Control Module

## 3. Database Design

### Core Entities

- `users`
- `categories`
- `products`
- `orders`
- `order_items`
- `event_logs`

### Normalization

The schema adheres to 3NF:

- User, product, category, and order data are separated by responsibility.
- Order items store product snapshots through quantity and unit price.
- Event logs store behavioral and operational traces separately from transactions.

## 4. ER Summary

```text
User 1 --- n Order 1 --- n OrderItem n --- 1 Product n --- 1 Category
User 1 --- n EventLog
```

## 5. Big Data Solution

The event table acts as the collection layer for:

- login behavior
- browsing behavior
- purchase behavior
- internal operations

Analytics services convert relational records into Pandas DataFrames for:

- top-seller aggregation
- rolling trend analysis
- anomaly inspection
- user segmentation
- collaborative filtering

## 6. Risk Assessment

### Technical Risks

- Sparse data can weaken recommendation quality.
- Forecast accuracy will be limited in early stages.
- SQLite/PostgreSQL differences can affect local-vs-prod testing.

### PM Contingencies

- Keep analytics algorithms modular and replaceable.
- Provide fallback recommendations for sparse data.
- Use environment-driven database configuration.
- Freeze API contracts before frontend integration.

