import type { DiagramNode, SharedStickyNote, StickyNoteColor } from "@/types";

export const SAMPLE_SCHEMA_SOURCE = `
CREATE TABLE tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  region_code CHAR(8) NOT NULL,
  billing_email VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug),
  KEY idx_tenants_region_created (region_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_settings (
  tenant_id BIGINT UNSIGNED NOT NULL,
  default_currency CHAR(3) NOT NULL,
  reservation_window_minutes INT NOT NULL,
  alert_email VARCHAR(191) NOT NULL,
  require_lot_tracking TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id),
  UNIQUE KEY uq_tenant_settings_alert_email (alert_email),
  CONSTRAINT fk_tenant_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  timezone_name VARCHAR(64) NOT NULL,
  profile_json JSON NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_last_seen (last_seen_at),
  KEY idx_users_display_name_created (display_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE memberships (
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  handle VARCHAR(64) NOT NULL,
  seat_label VARCHAR(64) NOT NULL,
  role VARCHAR(24) NOT NULL,
  invited_by_user_id BIGINT UNSIGNED NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, user_id),
  UNIQUE KEY uq_memberships_handle (tenant_id, handle),
  UNIQUE KEY uq_memberships_seat_label (tenant_id, seat_label),
  KEY idx_memberships_role_created (tenant_id, role, created_at),
  KEY idx_memberships_last_seen (last_seen_at),
  CONSTRAINT fk_memberships_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_memberships_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_memberships_inviter
    FOREIGN KEY (invited_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  tenant_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(48) NOT NULL,
  slug VARCHAR(96) NOT NULL,
  external_catalog_code VARCHAR(96) NOT NULL,
  title VARCHAR(191) NOT NULL,
  lifecycle VARCHAR(24) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (tenant_id, sku),
  UNIQUE KEY uq_products_slug (tenant_id, slug),
  UNIQUE KEY uq_products_external_code (tenant_id, external_catalog_code),
  KEY idx_products_lifecycle_created (tenant_id, lifecycle, created_at),
  CONSTRAINT fk_products_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_variants (
  tenant_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(48) NOT NULL,
  variant_code VARCHAR(48) NOT NULL,
  barcode VARCHAR(64) NULL,
  option_signature VARCHAR(191) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, sku, variant_code),
  UNIQUE KEY uq_variants_option_signature (tenant_id, sku, option_signature),
  UNIQUE KEY uq_variants_barcode (tenant_id, barcode),
  KEY idx_variants_default_created (tenant_id, is_default, created_at),
  CONSTRAINT fk_variants_product
    FOREIGN KEY (tenant_id, sku) REFERENCES products (tenant_id, sku)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE warehouses (
  tenant_id BIGINT UNSIGNED NOT NULL,
  warehouse_code VARCHAR(24) NOT NULL,
  name VARCHAR(128) NOT NULL,
  timezone_name VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, warehouse_code),
  UNIQUE KEY uq_warehouses_name (tenant_id, name),
  CONSTRAINT fk_warehouses_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_lots (
  tenant_id BIGINT UNSIGNED NOT NULL,
  warehouse_code VARCHAR(24) NOT NULL,
  lot_code VARCHAR(48) NOT NULL,
  sku VARCHAR(48) NOT NULL,
  variant_code VARCHAR(48) NOT NULL,
  expires_on DATE NULL,
  quantity_on_hand INT NOT NULL,
  quantity_reserved INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, warehouse_code, lot_code),
  KEY idx_stock_lots_variant_expiry (tenant_id, sku, variant_code, expires_on),
  KEY idx_stock_lots_balance (tenant_id, quantity_on_hand, quantity_reserved),
  CONSTRAINT fk_stock_lots_warehouse
    FOREIGN KEY (tenant_id, warehouse_code) REFERENCES warehouses (tenant_id, warehouse_code)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_stock_lots_variant
    FOREIGN KEY (tenant_id, sku, variant_code) REFERENCES product_variants (tenant_id, sku, variant_code)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  tenant_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  external_order_ref VARCHAR(64) NOT NULL,
  placed_by_user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  placed_at DATETIME(3) NOT NULL,
  promised_ship_at DATETIME(3) NULL,
  PRIMARY KEY (tenant_id, order_number),
  UNIQUE KEY uq_orders_external_ref (tenant_id, external_order_ref),
  KEY idx_orders_status_placed_at (tenant_id, status, placed_at),
  KEY idx_orders_priority_ship_at (tenant_id, priority, promised_ship_at),
  CONSTRAINT fk_orders_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (placed_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_lines (
  tenant_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  line_number INT NOT NULL,
  sku VARCHAR(48) NOT NULL,
  variant_code VARCHAR(48) NOT NULL,
  requested_qty INT NOT NULL,
  allocated_qty INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, order_number, line_number),
  KEY idx_order_lines_variant (tenant_id, sku, variant_code),
  KEY idx_order_lines_allocation_progress (tenant_id, allocated_qty, requested_qty),
  CONSTRAINT fk_order_lines_order
    FOREIGN KEY (tenant_id, order_number) REFERENCES orders (tenant_id, order_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_lines_variant
    FOREIGN KEY (tenant_id, sku, variant_code) REFERENCES product_variants (tenant_id, sku, variant_code)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pick_tasks (
  tenant_id BIGINT UNSIGNED NOT NULL,
  task_number VARCHAR(32) NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  line_number INT NOT NULL,
  warehouse_code VARCHAR(24) NOT NULL,
  lot_code VARCHAR(48) NOT NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, task_number),
  KEY idx_pick_tasks_status_created (tenant_id, status, created_at),
  KEY idx_pick_tasks_assignee_status (tenant_id, assigned_user_id, status),
  CONSTRAINT fk_pick_tasks_order_line
    FOREIGN KEY (tenant_id, order_number, line_number) REFERENCES order_lines (tenant_id, order_number, line_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pick_tasks_stock_lot
    FOREIGN KEY (tenant_id, warehouse_code, lot_code) REFERENCES stock_lots (tenant_id, warehouse_code, lot_code)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pick_tasks_user
    FOREIGN KEY (assigned_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  tenant_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(32) NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  external_invoice_ref VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  issued_at DATETIME(3) NOT NULL,
  paid_at DATETIME(3) NULL,
  PRIMARY KEY (tenant_id, invoice_number),
  UNIQUE KEY uq_invoices_order (tenant_id, order_number),
  UNIQUE KEY uq_invoices_external_ref (tenant_id, external_invoice_ref),
  KEY idx_invoices_status_issued (tenant_id, status, issued_at),
  CONSTRAINT invoice_for_order
    FOREIGN KEY (tenant_id, order_number) REFERENCES orders (tenant_id, order_number)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_lines (
  tenant_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(32) NOT NULL,
  line_number INT NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  order_line_number INT NOT NULL,
  line_amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, invoice_number, line_number),
  UNIQUE KEY uq_invoice_lines_order_line (tenant_id, order_number, order_line_number),
  CONSTRAINT fk_invoice_lines_invoice
    FOREIGN KEY (tenant_id, invoice_number) REFERENCES invoices (tenant_id, invoice_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_invoice_lines_order_line
    FOREIGN KEY (tenant_id, order_number, order_line_number) REFERENCES order_lines (tenant_id, order_number, line_number)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webhook_endpoints (
  endpoint_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  topic VARCHAR(96) NOT NULL,
  target_url VARCHAR(512) NOT NULL,
  signing_secret_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (endpoint_id),
  UNIQUE KEY uq_webhook_endpoints_target (tenant_id, topic, target_url),
  KEY idx_webhook_endpoints_active_created (tenant_id, is_active, created_at),
  CONSTRAINT fk_webhook_endpoints_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_webhook_endpoints_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webhook_deliveries (
  tenant_id BIGINT UNSIGNED NOT NULL,
  endpoint_id BIGINT UNSIGNED NOT NULL,
  delivery_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  attempt_number INT NOT NULL,
  status VARCHAR(24) NOT NULL,
  first_attempted_at DATETIME(3) NOT NULL,
  last_attempted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (tenant_id, endpoint_id, delivery_id),
  UNIQUE KEY uq_webhook_deliveries_order_attempt (tenant_id, order_number, attempt_number),
  KEY idx_webhook_deliveries_status_attempted (tenant_id, status, last_attempted_at),
  CONSTRAINT fk_webhook_deliveries_endpoint
    FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints (endpoint_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_webhook_deliveries_order
    FOREIGN KEY (tenant_id, order_number) REFERENCES orders (tenant_id, order_number)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const SAMPLE_STICKY_NOTE_WIDTH = 276;
const SAMPLE_STICKY_NOTE_HEIGHT = 172;
const SAMPLE_STICKY_NOTE_GAP = 44;
const SAMPLE_SCHEMA_SOURCE_COMPARISON = SAMPLE_SCHEMA_SOURCE.trim();

type NotePlacement = "top" | "right" | "bottom" | "left";

interface SampleStickyNoteDefinition {
	readonly id: string;
	readonly tables: readonly string[];
	readonly color: StickyNoteColor;
	readonly placement: NotePlacement;
	readonly text: string;
	readonly offsetX?: number;
	readonly offsetY?: number;
	readonly width?: number;
	readonly height?: number;
}

interface Bounds {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

const SAMPLE_STICKY_NOTES: readonly SampleStickyNoteDefinition[] = [
	{
		id: "sample-note-tenant-spine",
		tables: ["tenants", "tenant_settings", "memberships", "users"],
		color: "yellow",
		placement: "top",
		offsetX: -24,
		text: [
			"Tenant spine",
			"#tenants owns config in #tenant_settings and access in #memberships.",
			"Follow #memberships.invited_by_user_id to see the self-reference.",
		].join("\n"),
	},
	{
		id: "sample-note-inventory-path",
		tables: ["products", "product_variants", "stock_lots", "warehouses"],
		color: "blue",
		placement: "right",
		offsetY: -12,
		text: [
			"Inventory path",
			"#products branch into #product_variants.",
			"Watch #stock_lots.quantity_on_hand and #stock_lots.quantity_reserved in #warehouses.",
		].join("\n"),
	},
	{
		id: "sample-note-fulfillment-loop",
		tables: ["orders", "order_lines", "pick_tasks", "invoices"],
		color: "pink",
		placement: "bottom",
		offsetX: 18,
		text: [
			"Fulfillment loop",
			"#orders fan out into #order_lines.allocated_qty and spawn #pick_tasks.",
			"Billing closes through #invoices.status.",
		].join("\n"),
	},
];

const roundPosition = (value: number) => Math.round(value);

const getNodeBounds = (node: DiagramNode): Bounds => ({
	left: node.position.x,
	top: node.position.y,
	right: node.position.x + (node.width ?? node.data.layout.width),
	bottom: node.position.y + (node.height ?? node.data.layout.height),
});

const getBoundsForTables = (
	tables: readonly string[],
	nodesById: ReadonlyMap<string, DiagramNode>,
) => {
	let bounds: Bounds | null = null;

	for (const tableId of tables) {
		const node = nodesById.get(tableId);
		if (!node) return null;

		const nextBounds = getNodeBounds(node);
		bounds =
			bounds === null
				? nextBounds
				: {
						left: Math.min(bounds.left, nextBounds.left),
						top: Math.min(bounds.top, nextBounds.top),
						right: Math.max(bounds.right, nextBounds.right),
						bottom: Math.max(bounds.bottom, nextBounds.bottom),
					};
	}

	return bounds;
};

const placeStickyNote = (
	bounds: Bounds,
	definition: SampleStickyNoteDefinition,
) => {
	const width = definition.width ?? SAMPLE_STICKY_NOTE_WIDTH;
	const height = definition.height ?? SAMPLE_STICKY_NOTE_HEIGHT;
	const offsetX = definition.offsetX ?? 0;
	const offsetY = definition.offsetY ?? 0;
	const horizontalCenter = bounds.left + (bounds.right - bounds.left) / 2 - width / 2;
	const verticalCenter = bounds.top + (bounds.bottom - bounds.top) / 2 - height / 2;

	switch (definition.placement) {
		case "left":
			return {
				x: roundPosition(bounds.left - width - SAMPLE_STICKY_NOTE_GAP + offsetX),
				y: roundPosition(verticalCenter + offsetY),
			};
		case "right":
			return {
				x: roundPosition(bounds.right + SAMPLE_STICKY_NOTE_GAP + offsetX),
				y: roundPosition(verticalCenter + offsetY),
			};
		case "bottom":
			return {
				x: roundPosition(horizontalCenter + offsetX),
				y: roundPosition(bounds.bottom + SAMPLE_STICKY_NOTE_GAP + offsetY),
			};
		default:
			return {
				x: roundPosition(horizontalCenter + offsetX),
				y: roundPosition(bounds.top - height - SAMPLE_STICKY_NOTE_GAP + offsetY),
			};
	}
};

export const isSampleSchemaSource = (source: string) =>
	source.trim() === SAMPLE_SCHEMA_SOURCE_COMPARISON;

export const buildSampleStickyNotes = (
	nodes: readonly DiagramNode[],
): SharedStickyNote[] => {
	const nodesById = new Map(nodes.map((node) => [node.id, node] as const));

	return SAMPLE_STICKY_NOTES.flatMap((definition) => {
		const bounds = getBoundsForTables(definition.tables, nodesById);
		if (bounds === null) return [];

		const width = definition.width ?? SAMPLE_STICKY_NOTE_WIDTH;
		const height = definition.height ?? SAMPLE_STICKY_NOTE_HEIGHT;
		const position = placeStickyNote(bounds, definition);

		return [
			{
				id: definition.id,
				x: position.x,
				y: position.y,
				width,
				height,
				color: definition.color,
				text: definition.text,
			} satisfies SharedStickyNote,
		];
	});
};
