export const SAMPLE_DBML = `
  Project fulfillment_control_plane {
    database_type: "PostgreSQL"
    Note: 'Stress sample for composite keys, composite foreign keys, composite unique constraints, named indexes, FK actions, notes, and cross-schema refs.'
  }
  Enum identity.membership_role {
    owner
    admin
    operator
    analyst
  }
  Enum catalog.variant_lifecycle {
    draft
    active
    retired
  }
  Enum sales.order_status {
    draft
    confirmed
    allocated
    packed
    shipped
    cancelled
  }
  Enum ops.pick_task_status {
    queued
    in_progress
    blocked
    done
    cancelled
  }
  Enum billing.invoice_status {
    draft
    issued
    paid
    void
  }
  Enum telemetry.delivery_status {
    queued
    sending
    delivered
    failed
    dead_letter
  }
  // Start here in the canvas:
  // - identity.memberships for composite PK + multiple composite UNIQUE constraints
  // - sales.order_lines and billing.invoice_lines for composite FK edges
  // - core.tenant_settings and billing.invoices for one-to-one relations
  // - telemetry.webhook_endpoints for inline UQ chips without a redundant section
  Table core.tenants [note: 'Anchor table for every tenant-scoped composite key in the sample.'] {
    id uuid [pk, not null]
    slug varchar [unique, not null]
    name varchar [not null]
    region_code varchar [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      slug [name: 'uq_tenants_slug']
      (region_code, created_at) [name: 'idx_tenants_region_created']
    }
  }
  Table core.tenant_settings [note: 'One-to-one extension table: tenant_id is both PK and FK.'] {
    tenant_id uuid [pk, not null]
    default_currency varchar [not null]
    reservation_window_minutes int [not null]
    alert_email varchar [unique, not null]
    require_lot_tracking boolean [not null, default: false]
    created_at timestamptz [not null, default: \`now()\`]
  }
  Table identity.users [note: 'Global user directory; tenancy is applied through memberships.'] {
    id uuid [pk, not null]
    email varchar [unique, not null]
    display_name varchar [not null]
    timezone varchar [not null]
    last_seen_at timestamptz [note: 'Shows single-column INDEXED rendering']
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      last_seen_at [name: 'idx_users_last_seen']
      (display_name, created_at) [name: 'idx_users_display_name_created']
    }
  }
  Table identity.memberships [note: 'Stress table: composite PK + two composite UNIQUE constraints + named indexes.'] {
    tenant_id uuid [not null]
    user_id uuid [not null]
    handle varchar [not null, note: 'Composite unique within each tenant']
    seat_label varchar [not null, note: 'Second composite unique sharing tenant_id']
    role identity.membership_role [not null]
    invited_by_user_id uuid
    last_seen_at timestamptz
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, user_id) [pk]
      (tenant_id, handle) [unique, name: 'uq_memberships_handle', type: hash, note: 'No duplicate handles inside a tenant']
      (tenant_id, seat_label) [unique, name: 'uq_memberships_seat_label', note: 'Seat labels stay unique per tenant']
      (tenant_id, role, created_at) [name: 'idx_memberships_role_created', note: 'Highlights multi-column non-unique indexing']
      last_seen_at [name: 'idx_memberships_last_seen']
    }
  }
  Table catalog.products [note: 'Composite PK and multiple composite unique indexes for badge-heavy rows.'] {
    tenant_id uuid [not null]
    sku varchar [not null]
    slug varchar [not null]
    external_catalog_code varchar [not null]
    title varchar [not null]
    lifecycle catalog.variant_lifecycle [not null]
    created_at timestamptz [not null, default: \`now()\`]
    archived_at timestamptz
    indexes {
      (tenant_id, sku) [pk]
      (tenant_id, slug) [unique, name: 'uq_products_slug', note: 'URL-safe identity inside a tenant']
      (tenant_id, external_catalog_code) [unique, name: 'uq_products_external_code']
      (tenant_id, lifecycle, created_at) [name: 'idx_products_lifecycle_created']
    }
  }
  Table catalog.product_variants [note: 'Composite PK and composite FK back to products.'] {
    tenant_id uuid [not null]
    sku varchar [not null]
    variant_code varchar [not null]
    barcode varchar [unique]
    option_signature varchar [not null, note: 'Composite unique alongside the product key']
    unit_price numeric(12,2) [not null]
    is_default boolean [not null, default: false]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, sku, variant_code) [pk]
      (tenant_id, sku, option_signature) [unique, name: 'uq_variants_option_signature']
      (tenant_id, barcode) [unique, name: 'uq_variants_barcode']
      (tenant_id, is_default, created_at) [name: 'idx_variants_default_created']
    }
  }
  Table ops.warehouses [note: 'Composite warehouse identity scoped by tenant.'] {
    tenant_id uuid [not null]
    warehouse_code varchar [not null]
    name varchar [not null]
    timezone varchar [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, warehouse_code) [pk]
      (tenant_id, name) [unique, name: 'uq_warehouses_name']
    }
  }
  Table ops.stock_lots [note: 'Composite FK to both warehouse and product_variant.'] {
    tenant_id uuid [not null]
    warehouse_code varchar [not null]
    lot_code varchar [not null]
    sku varchar [not null]
    variant_code varchar [not null]
    expires_on date
    quantity_on_hand int [not null]
    quantity_reserved int [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, warehouse_code, lot_code) [pk]
      (tenant_id, sku, variant_code, expires_on) [name: 'idx_stock_lots_variant_expiry']
      (tenant_id, quantity_on_hand, quantity_reserved) [name: 'idx_stock_lots_balance']
    }
  }
  Table sales.orders [note: 'Composite PK with a one-to-one invoice and many composite children.'] {
    tenant_id uuid [not null]
    order_number varchar [not null]
    external_order_ref varchar [not null]
    placed_by_user_id uuid [not null]
    status sales.order_status [not null]
    priority int [not null, default: 0]
    placed_at timestamptz [not null]
    promised_ship_at timestamptz
    indexes {
      (tenant_id, order_number) [pk]
      (tenant_id, external_order_ref) [unique, name: 'uq_orders_external_ref']
      (tenant_id, status, placed_at) [name: 'idx_orders_status_placed_at']
      (tenant_id, priority, promised_ship_at) [name: 'idx_orders_priority_ship_at']
    }
  }
  Table sales.order_lines [note: 'Composite FK to orders and composite FK to product_variants.'] {
    tenant_id uuid [not null]
    order_number varchar [not null]
    line_number int [not null]
    sku varchar [not null]
    variant_code varchar [not null]
    requested_qty int [not null]
    allocated_qty int [not null]
    unit_price numeric(12,2) [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, order_number, line_number) [pk]
      (tenant_id, sku, variant_code) [name: 'idx_order_lines_variant']
      (tenant_id, allocated_qty, requested_qty) [name: 'idx_order_lines_allocation_progress']
    }
  }
  Table ops.pick_tasks [note: 'Composite FK to order_lines and composite FK to stock_lots.'] {
    tenant_id uuid [not null]
    task_number varchar [not null]
    order_number varchar [not null]
    line_number int [not null]
    warehouse_code varchar [not null]
    lot_code varchar [not null]
    assigned_user_id uuid
    status ops.pick_task_status [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, task_number) [pk]
      (tenant_id, status, created_at) [name: 'idx_pick_tasks_status_created']
      (tenant_id, assigned_user_id, status) [name: 'idx_pick_tasks_assignee_status']
    }
  }
  Table billing.invoices [note: 'Exactly one invoice per order in this sample, enforced by a composite UNIQUE.'] {
    tenant_id uuid [not null]
    invoice_number varchar [not null]
    order_number varchar [not null]
    external_invoice_ref varchar [not null]
    status billing.invoice_status [not null]
    issued_at timestamptz [not null]
    paid_at timestamptz
    indexes {
      (tenant_id, invoice_number) [pk]
      (tenant_id, order_number) [unique, name: 'uq_invoices_order']
      (tenant_id, external_invoice_ref) [unique, name: 'uq_invoices_external_ref']
      (tenant_id, status, issued_at) [name: 'idx_invoices_status_issued']
    }
  }
  Table billing.invoice_lines [note: 'Composite FK into invoices and composite FK into order_lines.'] {
    tenant_id uuid [not null]
    invoice_number varchar [not null]
    line_number int [not null]
    order_number varchar [not null]
    order_line_number int [not null]
    line_amount numeric(12,2) [not null]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, invoice_number, line_number) [pk]
      (tenant_id, order_number, order_line_number) [unique, name: 'uq_invoice_lines_order_line']
    }
  }
  Table telemetry.webhook_endpoints [note: 'Composite unique endpoint identity and user ownership.'] {
    id uuid [pk, not null]
    tenant_id uuid [not null]
    created_by_user_id uuid [not null]
    topic varchar [not null]
    target_url varchar [not null]
    signing_secret_hash varchar [not null]
    is_active boolean [not null, default: true]
    created_at timestamptz [not null, default: \`now()\`]
    indexes {
      (tenant_id, topic, target_url) [unique, name: 'uq_webhook_endpoints_target', note: 'Produces inline UQ chips without a separate table section']
      (tenant_id, is_active, created_at) [name: 'idx_webhook_endpoints_active_created']
    }
  }
  Table telemetry.webhook_deliveries [note: 'Composite unique retry envelope with actioned FK settings.'] {
    tenant_id uuid [not null]
    endpoint_id uuid [not null]
    delivery_id uuid [not null]
    order_number varchar [not null]
    attempt_number int [not null]
    status telemetry.delivery_status [not null]
    first_attempted_at timestamptz [not null]
    last_attempted_at timestamptz [not null]
    indexes {
      (tenant_id, endpoint_id, delivery_id) [pk]
      (tenant_id, order_number, attempt_number) [unique, name: 'uq_webhook_deliveries_order_attempt']
      (tenant_id, status, last_attempted_at) [name: 'idx_webhook_deliveries_status_attempted']
    }
  }
  Ref tenant_settings_for_tenant: core.tenants.id - core.tenant_settings.tenant_id [delete: cascade, update: cascade]
  Ref memberships_to_tenants: identity.memberships.tenant_id > core.tenants.id [delete: cascade, update: cascade]
  Ref memberships_to_users: identity.memberships.user_id > identity.users.id [delete: cascade, update: cascade]
  Ref memberships_to_inviter: identity.memberships.invited_by_user_id > identity.users.id [delete: set null, update: cascade]
  Ref products_to_tenants: catalog.products.tenant_id > core.tenants.id [delete: cascade, update: cascade]
  Ref variants_to_products: catalog.product_variants.(tenant_id, sku) > catalog.products.(tenant_id, sku) [delete: cascade, update: cascade]
  Ref warehouses_to_tenants: ops.warehouses.tenant_id > core.tenants.id [delete: cascade, update: cascade]
  Ref stock_lots_to_warehouses: ops.stock_lots.(tenant_id, warehouse_code) > ops.warehouses.(tenant_id, warehouse_code) [delete: cascade, update: cascade]
  Ref stock_lots_to_variants: ops.stock_lots.(tenant_id, sku, variant_code) > catalog.product_variants.(tenant_id, sku, variant_code) [delete: restrict, update: cascade]
  Ref orders_to_tenants: sales.orders.tenant_id > core.tenants.id [delete: cascade, update: cascade]
  Ref orders_to_users: sales.orders.placed_by_user_id > identity.users.id [delete: restrict, update: cascade]
  Ref order_lines_to_orders: sales.order_lines.(tenant_id, order_number) > sales.orders.(tenant_id, order_number) [delete: cascade, update: cascade]
  Ref order_lines_to_variants: sales.order_lines.(tenant_id, sku, variant_code) > catalog.product_variants.(tenant_id, sku, variant_code) [delete: restrict, update: cascade]
  Ref pick_tasks_to_order_lines: ops.pick_tasks.(tenant_id, order_number, line_number) > sales.order_lines.(tenant_id, order_number, line_number) [delete: cascade, update: cascade]
  Ref pick_tasks_to_stock_lots: ops.pick_tasks.(tenant_id, warehouse_code, lot_code) > ops.stock_lots.(tenant_id, warehouse_code, lot_code) [delete: restrict, update: cascade]
  Ref pick_tasks_to_users: ops.pick_tasks.assigned_user_id > identity.users.id [delete: set null, update: cascade]
  Ref invoice_for_order: sales.orders.(tenant_id, order_number) - billing.invoices.(tenant_id, order_number) [delete: restrict, update: cascade]
  Ref invoice_lines_to_invoices: billing.invoice_lines.(tenant_id, invoice_number) > billing.invoices.(tenant_id, invoice_number) [delete: cascade, update: cascade]
  Ref invoice_lines_to_order_lines: billing.invoice_lines.(tenant_id, order_number, order_line_number) > sales.order_lines.(tenant_id, order_number, line_number) [delete: restrict, update: cascade]
  Ref webhook_endpoints_to_tenants: telemetry.webhook_endpoints.tenant_id > core.tenants.id [delete: cascade, update: cascade]
  Ref webhook_endpoints_to_users: telemetry.webhook_endpoints.created_by_user_id > identity.users.id [delete: restrict, update: cascade]
  Ref webhook_deliveries_to_endpoints: telemetry.webhook_deliveries.endpoint_id > telemetry.webhook_endpoints.id [delete: cascade, update: cascade]
  Ref webhook_deliveries_to_orders: telemetry.webhook_deliveries.(tenant_id, order_number) > sales.orders.(tenant_id, order_number) [delete: cascade, update: cascade]
`;
