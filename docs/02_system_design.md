# 系统设计

## 架构图

```mermaid
flowchart LR
    Browser[React 前端] --> Nginx[Nginx 反向代理]
    Nginx --> API[FastAPI 后端]
    API --> DB[(PostgreSQL / SQLite)]
    API --> Redis[(Redis 缓存)]
    API --> Analytics[Pandas / NumPy / sklearn 分析服务]
    API --> Jobs[聚合作业与推荐作业]
    Jobs --> DB
    API --> Docs[导出 / 报表]
```

## 大数据流转

```mermaid
flowchart LR
    Events[登录 浏览 加购 搜索 购买 操作] --> Collect[FastAPI 路由层]
    Collect --> Store[EventLog / SearchLog / Order 表]
    Store --> Aggregate[DailyStat + HotSearch + Recommendation Cache 作业]
    Aggregate --> Analyze[RFM / Cohort / Funnel / Forecast / Churn]
    Analyze --> Visualize[Dashboard API / 前端图表]
```

## ER 图

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

## API 设计重点

| 模块 | 示例接口 |
| --- | --- |
| 认证 | `/auth/register`、`/auth/login`、`/auth/password-reset` |
| 商品 | `/products`、`/products/{id}`、`/products/{id}/reviews`、`/products/categories` |
| 订单 | `/orders/checkout`、`/orders/history` |
| 分析 | `/analytics/dashboard`、`/analytics/rfm`、`/analytics/cohorts`、`/analytics/funnel` |
| 推荐 | `/api/recommendations/personalized`、`/api/recommendations/trending` |
| 管理 | `/admin/sales-accounts`、`/analytics/jobs/daily-stats` |

## 关键设计决策

- 为适配 SQLite 本地开发，采用增量式模式演进与轻量列迁移策略
- 在正式部署流量到来前，通过高质量仿真数据模拟业务行为
- 分析结果主要基于交易表与事件表计算，保证可追溯性
- 设置推荐缓存表，模拟夜间离线预计算过程

## 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
| --- | --- | --- | --- |
| 范围失控 | 高 | 高 | 分阶段交付：先后端域模型，再前端，再文档 |
| 部署失败 | 中 | 高 | 提供 Docker Compose 基线与阿里云部署清单 |
| 数据不一致 | 中 | 高 | 订单事务写入、审计日志、聚合刷新作业 |
| 性能瓶颈 | 中 | 中 | 日统计缓存、推荐缓存、支持分页的接口 |
| 安全漏洞 | 中 | 高 | JWT 鉴权、角色守卫、ORM、防可疑行为日志 |
