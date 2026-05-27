# Smart Commerce Analytics Platform

Academic capstone monorepo for a "Network Application Architecture Design and Development" course. The project now targets a more mature e-commerce analytics platform with richer domain modeling, large-scale synthetic data, hybrid recommendations, and admin war-room analytics.

## Stack

- Backend: FastAPI, SQLAlchemy 2.0, Pydantic 2, Pandas, NumPy, scikit-learn
- Frontend: React + Vite
- Data: SQLite for local development, PostgreSQL-ready schema, Redis-ready configuration
- Deployment: Docker Compose with backend, frontend, PostgreSQL, Redis, and Nginx placeholders

## Structure

```text
ecommerce-analytics-app/
|-- analytics/
|-- backend/
|   |-- app/
|   |   |-- routers/
|   |   |-- services/
|   |   |-- seed.py
|   |   `-- seed_enhanced.py
|   |-- requirements.txt
|   `-- Dockerfile
|-- database/
|-- docs/
|   |-- 01_requirements.md
|   |-- 02_system_design.md
|   |-- 03_implementation.md
|   `-- 04_testing.md
|-- frontend/
|-- tests/
|-- docker-compose.yml
`-- .env.example
```

## Local Run

### Backend

```powershell
cd backend
python -m venv .venv39
.\.venv39\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
python -m app.seed_enhanced
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Notes:

- `frontend/src/api.js` defaults to `http://127.0.0.1:8000`.
- The backend now normalizes local SQLite paths to the backend directory and degrades gracefully if event logging fails.
- For this machine, running the backend outside the sandbox is necessary if SQLite writes are blocked by the execution environment.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Seeded Accounts

- Customer: `customer_test / password`
- VIP Customer: `customer_vip / password`
- Sales: `sales_test / password`
- Admin: `admin_test / password`

## Key Backend Capabilities

- JWT auth with role guards for customer, sales, and admin
- Enriched product model: variants, tags, reviews, inventory logs, supplier metadata
- Enriched user model: profile fields, membership tiers, addresses, behavior sessions, wishlist, coupons
- Enriched order model: workflow states, timeline, payment records, shipping tracking
- Marketing and search entities: banners, search logs, hot search trends
- Analytics endpoints for RFM, cohorts, funnel, geography, stockout, churn, recommendation metrics
- Hybrid recommendation APIs:
  - `GET /api/recommendations/personalized`
  - `GET /api/recommendations/similar/{product_id}`
  - `GET /api/recommendations/trending`
  - `GET /api/recommendations/frequently-bought-together/{product_id}`

## Large Data Seeding

`python -m app.seed_enhanced` creates:

- 500+ users
- 200+ products
- 2000+ orders
- 800+ reviews
- 10000+ browse events
- 3000+ cart-related events
- 2000+ search events

The script uses `Faker` with mixed Chinese and English profiles plus temporal, geographic, pricing, and seasonal behavior patterns.

## Analytics Endpoints

- `/analytics/dashboard`
- `/analytics/dashboard/war-room`
- `/analytics/forecast`
- `/analytics/rfm`
- `/analytics/cohorts`
- `/analytics/funnel`
- `/analytics/journeys`
- `/analytics/ltv`
- `/analytics/category-performance`
- `/analytics/geography`
- `/analytics/inventory-alerts`
- `/analytics/stockout-predictions`
- `/analytics/churn-predictions`
- `/analytics/recommendation-metrics`

## Documentation

Course-facing documents are in `docs/`:

- [Requirements Analysis](docs/01_requirements.md)
- [System Design](docs/02_system_design.md)
- [Implementation Report](docs/03_implementation.md)
- [Test Report](docs/04_testing.md)

## Current Status

This pass stabilizes login/runtime, expands the backend data model and analytics services, and adds the enhanced seed path. The React frontend still needs a broader UI refactor to expose all new backend capabilities cleanly, especially the dedicated large-screen dashboard and richer customer center flows.
