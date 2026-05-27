# Requirements Analysis Report

## 1. Business Scenario

This project targets a medium-sized online retail business that wants to combine routine e-commerce operations with data-driven sales management. The main pain point is that traditional course-demo shopping sites often stop at catalog and order features, while the course explicitly requires evidence of network application architecture design, role-based operations, operational logging, analytics, and recommendation.

The proposed solution is a three-role system:

- Customers browse, purchase, and receive recommendations.
- Sales staff maintain product information and monitor activity.
- Admin users govern sales accounts and audit performance.

## 2. Pain Points

1. Business data is usually scattered across application tables and not prepared for analytics.
2. Staff operations are hard to audit without explicit logging.
3. Manual sales trend discovery is slow and subjective.
4. Product recommendation is absent in most basic student projects.
5. Security boundaries between customer and internal operators are often weak.

## 3. Functional Scope

- Authentication, registration, login, password reset
- Product/category management
- Cart and checkout simulation
- Purchase history
- User behavior and operation logging
- Analytics dashboard and recommendation engine

## 4. Feasibility

### Technical Feasibility

FastAPI and React are appropriate because:

- FastAPI provides clear REST APIs and Pydantic validation.
- React supports role-specific dashboards in a single frontend.
- PostgreSQL supports normalized transaction and event storage.
- Pandas and Scikit-learn are sufficient for academic-level analytics.

### Operational Feasibility

The system can run locally with SQLite for development and switch to PostgreSQL for deployment. Docker Compose lowers deployment complexity and improves reproducibility.

### Schedule Feasibility

The project is achievable for an individual if developed in phases:

1. Core backend and schema
2. Frontend role flows
3. Analytics and recommendation
4. Testing and deployment
5. Report polishing

## 5. Development Roadmap

### Phase 1

- Define roles, schema, and REST API contract
- Implement authentication and catalog

### Phase 2

- Add checkout and purchase history
- Add sales/admin management endpoints

### Phase 3

- Add event logging, dashboards, and recommendation logic
- Complete documentation and deployment scripts

## 6. Milestones

- Week 1: requirements, schema draft, architecture confirmation
- Week 2: authentication and product APIs
- Week 3: frontend catalog and orders
- Week 4: analytics and recommendation
- Week 5: testing and reports

