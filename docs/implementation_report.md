# System Implementation Report

## 1. Development Environment

- OS: Windows
- Backend: Python 3.11, FastAPI, SQLAlchemy
- Frontend: Node.js 20, React, Vite
- Database: PostgreSQL target, SQLite development fallback
- Analytics: Pandas, NumPy, Scikit-learn

## 2. Source Code Overview

The backend is divided into routers, services, security, models, and schemas. The frontend is a responsive SPA that consumes REST endpoints and renders role-specific workflows.

## 3. Deployment Steps

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis.
3. Run backend dependencies and launch `uvicorn`.
4. Run frontend via Vite or build with Docker.
5. Seed test accounts with `python -m app.seed`.

## 4. AI Tool Usage Log

### Tools Used

- Codex / GPT-based coding assistant
- GitHub Copilot style completion workflow
- Cursor/Claude-style structured code assistance in the planning model

### Usage Frequency

- High during architecture design and scaffolding
- Medium during repetitive CRUD, schema, and docs generation
- Medium during report drafting and test artifact preparation

### Primary Purposes

- generating initial project structure
- producing boilerplate CRUD and schema code
- accelerating documentation drafts
- highlighting missing feature connections between modules

### Efficiency Analysis

AI assistance reduced repetitive implementation time significantly in three areas:

1. Scaffolding:
   Generating the initial monorepo structure, dependency files, Docker setup, and report templates would normally require manual repetitive work. AI reduced this startup phase from multiple hours to under one hour.
2. Cross-module consistency:
   The same entity names, route prefixes, and role labels must remain consistent between models, routers, schemas, and frontend consumers. AI helped maintain naming alignment and reduced the likelihood of small integration bugs caused by inconsistent naming.
3. Documentation:
   Course projects often fail not because the code is incomplete, but because the documentation is late or fragmented. AI improved the speed of producing structured drafts for requirements, design, implementation, and testing reports.

The best use cases were:

- transforming feature lists into module boundaries
- converting data requirements into schema fields
- drafting test case matrices and deployment notes

Limitations remained clear:

- AI can over-generate boilerplate that still needs human review
- generated analytics logic must be checked for statistical reasonableness
- deployment claims must be verified against actual infrastructure

### Case Study 1: RBAC Scaffolding

The project required three roles with distinct permissions. AI helped convert the natural-language requirement into a consistent enum, dependency guard, and route-level protection structure. This saved design time and avoided duplicating authorization logic in each endpoint.

### Case Study 2: Analytics Service Design

The analytics requirement was broad and could have led to an unstructured implementation. AI assistance made it easier to convert that requirement into a focused service module with explicit outputs: top products, sales trends, anomaly alerts, and user profile summaries. This improved modularity and made the dashboard API easier to consume.

### Case Study 3: Academic Reporting

The project needs more than code: it needs PM-style analysis and reflection. AI helped transform raw implementation decisions into formal report sections with business value, risk language, and milestone framing suitable for course submission.

### 500+ Word Reflection on AI-Assisted Programming

AI-assisted programming changed the way this project was planned and implemented, but it did not remove the need for engineering judgment. The biggest benefit was compression of low-value repetition. In a full-stack academic project, a large percentage of time can be lost on setup work: folder structure, dependency declarations, repetitive CRUD patterns, report skeletons, environment notes, and basic UI scaffolding. AI substantially reduced that overhead. That time saving matters because the course does not grade setup alone; it grades architecture, feature coverage, analytics thinking, and documentation quality. By reducing the friction of startup and boilerplate, AI made it easier to invest time in the parts that actually demonstrate understanding.

Another major advantage was structural thinking. When given a long feature list, AI can quickly reframe the problem into modules, entities, route groups, and responsibilities. This is useful because many student projects fail from weak decomposition rather than weak coding ability. In this project, the requirements included authentication, commerce, event logging, analytics, recommendations, and reporting. Without a structured plan, it would be easy to mix these concerns together and create a codebase that is hard to explain in the final defense. AI support made it easier to keep the boundaries clear: routers for HTTP concerns, services for analytics and logging, schemas for validation, and frontend views for role-specific flows.

However, AI assistance also has sharp limits. It tends to produce code that looks complete before it is truly verified. For example, analytics code may run syntactically but still reflect weak assumptions, sparse-data problems, or overly simple statistical logic. Recommendation systems are especially sensitive to this issue. A generated collaborative filtering function can appear correct, but if the dataset is too small or the matrix is too sparse, the practical result may be poor. That means AI should be treated as a drafting partner, not as an authority. Human review remains necessary for correctness, consistency, and appropriateness to the project goals.

AI was also most valuable when prompts were precise. Vague requests led to generic output, while explicit requests about roles, event fields, deliverables, or report structure produced much better results. This reinforced an important lesson: effective AI use is itself a technical skill. The programmer still has to define boundaries, evaluate tradeoffs, and reject weak output. In that sense, AI does not replace software engineering discipline; it amplifies it when the user already has a clear target.

From a project management perspective, AI helped reduce schedule risk. Documentation and implementation could progress in parallel, and repetitive pieces were delivered faster. That said, relying on AI without validation would create a different kind of risk: false confidence. The correct workflow is therefore iterative. Generate, inspect, refine, test, document, and then re-check assumptions. Used this way, AI was not just a productivity tool. It became a multiplier for planning clarity, consistency, and delivery speed while still requiring active human responsibility for the final result.

## 5. Project Reflection

From a PM perspective, the project benefits from a clear separation between must-have course requirements and optional enhancement opportunities. The main lesson is that analytics requirements should be designed into the schema from day one. Retrofitting logs and recommendation inputs after the commerce flow is built is much harder than collecting the right data from the start.

