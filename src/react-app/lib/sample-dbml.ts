export const SAMPLE_DBML = `
  Project sample_system {
    database_type: "PostgreSQL"
  }

  Enum user_role {
    admin
    manager
    staff
    customer
  }

  Enum order_status {
    pending
    confirmed
    shipped
    delivered
    cancelled
  }

  Enum payment_status {
    pending
    paid
    failed
    refunded
  }

  Table tenants {
    id uuid [pk]
    name varchar
    is_active boolean
    created_at timestamp
  }

  Table users {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    username varchar
    email varchar [unique]
    role user_role
    is_active boolean
    created_at timestamp
  }

  Table sessions {
    id uuid [pk]
    user_id uuid [ref: > users.id]
    token varchar
    expires_at timestamp
    created_at timestamp
  }

  Table categories {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    name varchar
  }

  Table products {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    category_id uuid [ref: > categories.id]
    name varchar
    description text
    price decimal
    stock int
    created_at timestamp
  }

  Table product_images {
    id uuid [pk]
    product_id uuid [ref: > products.id]
    url varchar
    alt_text varchar
  }

  Table warehouses {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    name varchar
    location varchar
  }

  Table inventory {
    id uuid [pk]
    product_id uuid [ref: > products.id]
    warehouse_id uuid [ref: > warehouses.id]
    quantity int
  }

  Table customers {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    name varchar
    email varchar
    phone varchar
  }

  Table addresses {
    id uuid [pk]
    customer_id uuid [ref: > customers.id]
    line1 varchar
    line2 varchar
    city varchar
    state varchar
    country varchar
    zip varchar
  }

  Table orders {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    customer_id uuid [ref: > customers.id]
    status order_status
    total_amount decimal
    created_at timestamp
  }

  Table order_items {
    id uuid [pk]
    order_id uuid [ref: > orders.id]
    product_id uuid [ref: > products.id]
    quantity int
    price decimal
  }

  Table payments {
    id uuid [pk]
    order_id uuid [ref: > orders.id]
    status payment_status
    amount decimal
    provider varchar
    created_at timestamp
  }

  Table shipments {
    id uuid [pk]
    order_id uuid [ref: > orders.id]
    address_id uuid [ref: > addresses.id]
    tracking_number varchar
    shipped_at timestamp
    delivered_at timestamp
  }

  Table reviews {
    id uuid [pk]
    product_id uuid [ref: > products.id]
    customer_id uuid [ref: > customers.id]
    rating int
    comment text
    created_at timestamp
  }

  Table suppliers {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    name varchar
    contact_email varchar
  }

  Table purchase_orders {
    id uuid [pk]
    supplier_id uuid [ref: > suppliers.id]
    status varchar
    total_amount decimal
    created_at timestamp
  }

  Table purchase_order_items {
    id uuid [pk]
    purchase_order_id uuid [ref: > purchase_orders.id]
    product_id uuid [ref: > products.id]
    quantity int
    cost decimal
  }

  Table audits {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    user_id uuid [ref: > users.id]
    action varchar
    entity varchar
    entity_id uuid
    created_at timestamp
  }

  Table notifications {
    id uuid [pk]
    user_id uuid [ref: > users.id]
    title varchar
    message text
    is_read boolean
    created_at timestamp
  }

  Table tags {
    id uuid [pk]
    name varchar
  }

  Table product_tags {
    product_id uuid [ref: > products.id]
    tag_id uuid [ref: > tags.id]

    Indexes {
      (product_id, tag_id) [pk]
    }
  }

  Table coupons {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    code varchar [unique]
    discount decimal
    expires_at timestamp
  }

  Table order_coupons {
    order_id uuid [ref: > orders.id]
    coupon_id uuid [ref: > coupons.id]

    Indexes {
      (order_id, coupon_id) [pk]
    }
  }

  Table logs {
    id uuid [pk]
    level varchar
    message text
    context json
    created_at timestamp
  }

  Table api_keys {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    key varchar [unique]
    created_at timestamp
  }

  Table webhooks {
    id uuid [pk]
    tenant_id uuid [ref: > tenants.id]
    url varchar
    event varchar
    created_at timestamp
  }

  Table webhook_events {
    id uuid [pk]
    webhook_id uuid [ref: > webhooks.id]
    payload json
    delivered boolean
    created_at timestamp
  }
  `;
