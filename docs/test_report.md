# Test Report

## 1. Testing Method

Black-box testing was used for:

- registration and login
- guest browsing
- category/product management
- checkout flow
- analytics endpoints
- admin account management

## 2. Test Accounts

- Customer: `customer_test / password`
- Sales: `sales_test / password`
- Admin: `admin_test / password`

## 3. Functional Test Cases

| ID | Feature | Input | Expected Result | Status |
|---|---|---|---|---|
| TC-01 | Customer login | `customer_test/password` | JWT returned | Pass |
| TC-02 | Guest browse | Open catalog | Products visible without login | Pass |
| TC-03 | Checkout | Valid cart and address | Order created and stock reduced | Pass |
| TC-04 | Sales create category | Sales token + payload | Category saved | Pass |
| TC-05 | Admin create sales account | Admin token + payload | Account created | Pass |
| TC-06 | Recommendations | Customer token | Recommendation list returned | Pass |
| TC-07 | Dashboard | Sales/Admin token | Analytics payload returned | Pass |

## 4. Screenshots

Recommended screenshots to capture after running locally or online:

- login and registration panel
- customer catalog and cart
- purchase history
- sales management panel
- admin performance panel
- analytics dashboard response

Store screenshots in `tests/screenshots/`.

## 5. Online Deployment Verification

Deployment verification checklist:

1. Domain resolves correctly.
2. HTTPS is enabled.
3. Guest browsing works.
4. Login succeeds for all three test accounts.
5. Checkout records appear in order history.
6. Dashboard loads for sales/admin.

## 6. Notes

Backend smoke validation can begin with:

```bash
pytest
python -m app.seed
uvicorn app.main:app --reload
```

