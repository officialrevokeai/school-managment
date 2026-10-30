ALTER TABLE message_requests ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE message_requests ADD outbound_kind text NOT NULL DEFAULT 'template' CHECK(outbound_kind IN ('template','text'));
ALTER TABLE message_requests ADD text_body text;
ALTER TABLE message_requests ADD inbound_context_id text;
ALTER TABLE message_requests ADD FOREIGN KEY(org_id,inbound_context_id) REFERENCES inbound_messages(org_id,id);
ALTER TABLE message_requests ADD CHECK((outbound_kind='template' AND template_id IS NOT NULL AND text_body IS NULL) OR (outbound_kind='text' AND template_id IS NULL AND text_body IS NOT NULL AND inbound_context_id IS NOT NULL));
CREATE TABLE refunds (id text PRIMARY KEY, org_id text NOT NULL, payment_id text NOT NULL, provider_refund_id text NOT NULL UNIQUE, amount_minor integer NOT NULL CHECK(amount_minor>0), currency text NOT NULL CHECK(currency='INR'), status text NOT NULL CHECK(status IN ('pending','processed','failed')), applied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id), FOREIGN KEY(org_id,payment_id) REFERENCES payments(org_id,id));
CREATE TABLE refund_allocations (org_id text NOT NULL, refund_id text NOT NULL, payment_id text NOT NULL, invoice_id text NOT NULL, amount_minor integer NOT NULL CHECK(amount_minor>0), PRIMARY KEY(org_id,refund_id,invoice_id), FOREIGN KEY(org_id,refund_id) REFERENCES refunds(org_id,id), FOREIGN KEY(org_id,payment_id,invoice_id) REFERENCES payment_allocations(org_id,payment_id,invoice_id));
