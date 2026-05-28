# 测试报告

## 测试策略

- 单元测试：针对分析服务与鉴权辅助函数
- 集成测试：覆盖 FastAPI 的认证、商品目录、结算与分析接口流程
- 手工黑盒测试：覆盖前端角色流程、大屏渲染与推荐模块展示
- 安全探测：错误凭证、角色越权、XSS 载荷与 SQL 注入模式

## 功能测试用例

| ID | 模块 | 测试项 | 步骤 | 期望结果 | 实际结果 | 状态 | 截图 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | 认证 | 客户登录 | 提交 `customer_test / password` | 返回 JWT，角色为 customer | 日志修复后通过 | 通过 | [Screenshot: Login] |
| T02 | 认证 | 非法登录 | 输入错误密码 | 返回 401，无效凭证 | 符合预期 | 通过 | [Screenshot: Invalid Login] |
| T03 | 认证 | 用户注册 | 注册一个新客户 | 成功创建用户 | 待重新手工验证 | 待验证 | [Screenshot: Register] |
| T04 | 商品目录 | 商品列表 | 打开商品目录 API | 返回商品列表 | 通过 | 通过 | [Screenshot: Catalog] |
| T05 | 商品目录 | 按分类筛选 | 应用分类过滤条件 | 仅返回匹配商品 | 待验证 | 待验证 | [Screenshot: Category Filter] |
| T06 | 商品目录 | 商品搜索 | 输入关键词搜索 | 返回相关商品 | 待验证 | 待验证 | [Screenshot: Search] |
| T07 | 商品 | 商品详情 | 打开商品详情页 | 包含变体与评价数据 | 待验证 | 待验证 | [Screenshot: Product Detail] |
| T08 | 商品 | 提交评价 | 客户提交评价 | 评价保存成功 | 待验证 | 待验证 | [Screenshot: Review] |
| T09 | 购物车 | 加入购物车 | 游客添加商品 | 本地购物车更新 | 待验证 | 待验证 | [Screenshot: Cart] |
| T10 | 结算 | 模拟支付 | 客户提交结算 | 创建订单并扣减库存 | 待验证 | 待验证 | [Screenshot: Checkout] |
| T11 | 订单 | 订单历史 | 客户打开历史订单 | 展示带时间线的订单记录 | 待验证 | 待验证 | [Screenshot: Order History] |
| T12 | 管理 | 销售账号列表 | 管理员调用账号接口 | 返回销售用户列表 | 待验证 | 待验证 | [Screenshot: Sales Accounts] |
| T13 | 分析 | 仪表盘概览 | 销售打开 `/analytics/dashboard` | 返回汇总分析数据 | 待验证 | 待验证 | [Screenshot: Analytics Overview] |
| T14 | 分析 | RFM | 打开 `/analytics/rfm` | 返回分层摘要 | 待验证 | 待验证 | [Screenshot: RFM] |
| T15 | 分析 | 同期群 | 打开 `/analytics/cohorts` | 返回留存行数据 | 待验证 | 待验证 | [Screenshot: Cohorts] |
| T16 | 分析 | 漏斗 | 打开 `/analytics/funnel` | 返回漏斗步骤数据 | 待验证 | 待验证 | [Screenshot: Funnel] |
| T17 | 推荐 | 个性化推荐 | 客户访问个性化接口 | 返回混合推荐结果 | 待验证 | 待验证 | [Screenshot: Personalized Reco] |
| T18 | 推荐 | 相似商品 | 查询相似商品接口 | 返回基于内容的推荐项 | 待验证 | 待验证 | [Screenshot: Similar Products] |
| T19 | 推荐 | 一起购买 | 查询关联购买接口 | 返回共现推荐项 | 待验证 | 待验证 | [Screenshot: FBT] |
| T20 | 安全 | 角色越权 | 客户请求管理员接口 | 返回 403 | 待验证 | 待验证 | [Screenshot: 403] |
| T21 | 安全 | SQL 注入字符串 | 发送类似注入的搜索词 | 不执行 SQL，安全返回 | 待验证 | 待验证 | [Screenshot: Injection] |
| T22 | 安全 | XSS 载荷 | 在评价中提交脚本 | 被转义或存储后不执行 | 待验证 | 待验证 | [Screenshot: XSS] |

## 性能

- 目标场景：针对商品列表接口与分析只读接口进行 100 并发请求
- 建议工具：`locust`
- 期望指标：
  - 商品列表 p95 < 500ms
  - 登录 p95 < 300ms
  - 仪表盘 p95 < 1200ms（因聚合较重）

## 安全检查

- 通过搜索关键字尝试 SQL 注入：ORM 查询构造可防止直接注入
- 在评价内容中尝试 XSS：前端必须仅渲染转义后的内容
- 尝试绕过管理员接口鉴权：`require_roles` 应阻止访问
- 可疑活动日志模型可支持对请求频率与指纹异常进行展示

## 部署验证

- 后端本地地址：`http://127.0.0.1:8000`
- 前端本地地址：`http://127.0.0.1:5173`
- 健康检查：`GET /health`
- 必备测试账号：
  - `customer_test / password`
  - `customer_vip / password`
  - `sales_test / password`
  - `admin_test / password`

## 备注

- 登录回归问题已在 HTTP 层确认修复，前提是事件日志改为非致命写入，并使用可写数据库路径运行后端。
- 模式扩展后的完整端到端回归仍需要重新准备种子数据库，并安装包括 `Faker` 在内的完整依赖。
