# Test Report

## Strategy

- Unit tests: service-level analytics and auth helpers
- Integration tests: FastAPI endpoint flows for auth, catalog, checkout, analytics
- Manual black-box testing: frontend role flows, dashboard rendering, recommendation sections
- Security probing: invalid credentials, role bypass, XSS payloads, SQL injection patterns

## Functional Test Cases

| ID | Module | Test Item | Steps | Expected Result | Actual Result | Status | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Auth | Customer login | Submit `customer_test / password` | JWT returned, user role customer | Pass after logger fix | Pass | [Screenshot: Login] |
| T02 | Auth | Invalid login | Wrong password | 401 invalid credentials | As designed | Pass | [Screenshot: Invalid Login] |
| T03 | Auth | Registration | Register a new customer | User created | Pending manual rerun | Pending | [Screenshot: Register] |
| T04 | Catalog | List products | Open catalog API | Product list returns | Pass | Pass | [Screenshot: Catalog] |
| T05 | Catalog | Filter by category | Apply category filter | Only matching products | Pending | Pending | [Screenshot: Category Filter] |
| T06 | Catalog | Search products | Search keyword | Relevant products returned | Pending | Pending | [Screenshot: Search] |
| T07 | Product | Product detail | Open product detail | Variant and review data included | Pending | Pending | [Screenshot: Product Detail] |
| T08 | Product | Submit review | Customer posts review | Review saved | Pending | Pending | [Screenshot: Review] |
| T09 | Cart | Add to cart | Add product as guest | Local cart updates | Pending | Pending | [Screenshot: Cart] |
| T10 | Checkout | Simulated payment | Customer checks out | Order created, stock reduced | Pending | Pending | [Screenshot: Checkout] |
| T11 | Orders | Order history | Customer opens history | Orders with timeline shown | Pending | Pending | [Screenshot: Order History] |
| T12 | Admin | Sales account list | Admin calls account API | Sales users returned | Pending | Pending | [Screenshot: Sales Accounts] |
| T13 | Analytics | Dashboard overview | Sales opens `/analytics/dashboard` | Summary payload returned | Pending | Pending | [Screenshot: Analytics Overview] |
| T14 | Analytics | RFM | Open `/analytics/rfm` | Segment summary returned | Pending | Pending | [Screenshot: RFM] |
| T15 | Analytics | Cohorts | Open `/analytics/cohorts` | Cohort retention rows returned | Pending | Pending | [Screenshot: Cohorts] |
| T16 | Analytics | Funnel | Open `/analytics/funnel` | Funnel steps returned | Pending | Pending | [Screenshot: Funnel] |
| T17 | Reco | Personalized | Customer opens personalized endpoint | Hybrid recommendations returned | Pending | Pending | [Screenshot: Personalized Reco] |
| T18 | Reco | Similar items | Query similar products | Content-based items returned | Pending | Pending | [Screenshot: Similar Products] |
| T19 | Reco | Bought together | Query affinity endpoint | Co-occurrence items returned | Pending | Pending | [Screenshot: FBT] |
| T20 | Security | Role bypass | Customer requests admin endpoint | 403 returned | Pending | Pending | [Screenshot: 403] |
| T21 | Security | SQL injection string | Send injection-like search term | No SQL execution, safe response | Pending | Pending | [Screenshot: Injection] |
| T22 | Security | XSS payload | Submit script in review | Escaped or stored without execution | Pending | Pending | [Screenshot: XSS] |

## Performance

- Target scenario: 100 concurrent requests against product listing and analytics read endpoints
- Suggested tool: `locust`
- Expected metrics:
  - Product listing p95 < 500ms on seeded local dataset
  - Login p95 < 300ms
  - Dashboard p95 < 1200ms because of heavy aggregation

## Security Checks

- SQL injection attempt via search query: ORM query construction prevents direct injection
- XSS attempt in review content: frontend must render escaped content only
- Auth bypass attempt on admin routes: blocked by `require_roles`
- Suspicious activity log model supports dashboard surfacing for rate and fingerprint anomalies

## Deployment Verification

- Backend local URL: `http://127.0.0.1:8000`
- Frontend local URL: `http://127.0.0.1:5173`
- Health check: `GET /health`
- Required test accounts:
  - `customer_test / password`
  - `customer_vip / password`
  - `sales_test / password`
  - `admin_test / password`

## Notes

- The login regression was verified fixed at the HTTP layer after making event logging non-fatal and running the backend with writable DB access.
- Full end-to-end regression after the schema expansion still needs a fresh seeded database and dependency install including `Faker`.
