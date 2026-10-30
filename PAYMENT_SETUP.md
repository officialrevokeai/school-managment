# Payments — acceptance open

Uses official Razorpay [orders](https://razorpay.com/docs/api/orders/create/), [Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [signed callbacks](https://razorpay.com/docs/webhooks/validate-test/). See PROVIDER_RESEARCH.md.

Owner → Fees → Gateway setup returns account-specific key-ID/API-secret/webhook-secret names. Configure actual test merchant identity and secrets in .env.runtime, then subscribe public HTTPS /webhooks/razorpay/ACCOUNT_ID to captured-payment/order-paid/refund events. No credentials/callback were supplied and no real sandbox checkout occurred.

Invoice totals use exact integer paise. Parent orders reserve authoritative unpaid linked-child invoices; students cannot initiate payment. A browser callback/redirect/click or uncaptured authorization cannot issue a receipt. The worker verifies signed events and independently fetches capture state, matching merchant/order/amount/currency before atomic allocations, ledger and one receipt. Replays and out-of-order events cannot double-apply it.

Uncertain order creation stays reserved for operator reconciliation. Do not manually mark it paid or create a replacement until provider state is reconciled. Automated discovery/reconciliation of a lost provider-order response is still a release gap. Pending/failure evidence produces no confirmed receipt.

Only fetched processed refunds reverse their original allocations, once, and reopen invoice balances. Pending/failed refunds do not. Refund initiation remains in the merchant dashboard. Offline collections require an authorized human verification statement/reference and remain distinct from gateway capture. Payroll records external payouts and transfers no funds.

Production charges require separate explicit owner authorization, valid merchant setup and ALLOW_LIVE_PAYMENTS=true. This development task authorizes no real charge.
