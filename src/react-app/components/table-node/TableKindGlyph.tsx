import { tableNodeMetrics, tableNodeStyles } from "@/components/table-node/metrics";

export function TableKindGlyph() {
	return (
		<svg
			className="schema-table-glyph shrink-0"
			style={tableNodeStyles.headerGlyph}
			width={tableNodeMetrics.header.glyphSize}
			height={tableNodeMetrics.header.glyphSize}
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.25"
			aria-hidden="true"
		>
			<rect x="0.625" y="0.625" width="10.75" height="10.75" rx="1.5" />
			<line x1="0.625" y1="4.5" x2="11.375" y2="4.5" />
			<line x1="0.625" y1="8" x2="11.375" y2="8" />
		</svg>
	);
}
