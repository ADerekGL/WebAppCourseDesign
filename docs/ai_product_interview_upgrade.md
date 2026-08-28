# AI Product Interview Upgrade

## Positioning

This upgrade reframes the coursework project as a lightweight AI commerce intelligence platform for interview and portfolio scenarios.

The product story is:

- collect user, order, search, inventory, and operation data
- transform raw events into business signals
- generate recommendation, forecast, churn, and inventory insights
- explain why a product is recommended
- surface next actions for sales and admin users

## New Product Capabilities

### AI Operating Brief

The sales/admin dashboard now exposes an operating brief built from recent GMV, orders, conversion proxy, category momentum, inventory risk, churn risk, and recommendation health.

API:

```text
GET /analytics/insights
```

The response contains:

- headline summary
- KPI metrics
- operational signals
- suggested next actions
- recommendation health
- evaluation notes and risk boundary

### Recommendation Explanation

Product detail pages now include an explanation layer for recommendations. The system explains products through demand signal, category fit, brand adjacency, tag coverage, bundle potential, and user preference match.

API:

```text
GET /api/recommendations/explain/{product_id}
```

This makes the recommendation module easier to present as a product feature instead of a hidden algorithm.

## Interview Narrative

The best way to describe this project:

> I upgraded a course e-commerce project into a lightweight AI commerce intelligence platform. The core work was not simply adding algorithms, but defining a closed product loop: event collection, recommendation and analytics services, explainable outputs, evaluation metrics, and operational actions for sales/admin users.

## Evaluation Framing

The product can be evaluated with:

- recommendation coverage
- recommendation diversity
- mock CTR and conversion proxy
- inventory alert count
- churn candidate count
- GMV and order trend
- role-based task completion

## Risk Boundary

- Payment is a simulated checkout flow.
- Forecast and churn signals are course-scale heuristics.
- Recommendation metrics are offline proxies unless connected to live click logs.
- Business suggestions are decision support, not automatic execution.

