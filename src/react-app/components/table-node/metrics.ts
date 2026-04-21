import type { CSSProperties } from "react";

type FontWeight = NonNullable<CSSProperties["fontWeight"]>;

export interface TableNodeFontMetrics {
	readonly family: string;
	readonly font: string;
	readonly lineHeight: number;
	readonly size: number;
	readonly style: Readonly<CSSProperties>;
	readonly weight: FontWeight;
}

function freezeStyle(style: CSSProperties): Readonly<CSSProperties> {
	return Object.freeze(style);
}

function createFontMetrics(
	family: string,
	size: number,
	lineHeight: number,
	weight: FontWeight,
): TableNodeFontMetrics {
	return Object.freeze({
		family,
		font: `${weight} ${size}px ${family}`,
		lineHeight,
		size,
		style: freezeStyle({
			fontFamily: family,
			fontSize: size,
			fontWeight: weight,
			lineHeight: `${lineHeight}px`,
		}),
		weight,
	});
}

const SANS_FAMILY = '"Noto Sans Variable", sans-serif';
const MONO_FAMILY =
	"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export const tableNodeMetrics = Object.freeze({
	maxWidth: 480,
	minWidth: 300,
	nodeBorder: 1,
	sectionBorder: 1,
	header: Object.freeze({
		gap: 8,
		glyphSize: 18,
		glyphTopOffset: 5,
		kindGap: 10,
		kindTopOffset: 1,
		padX: 10,
		padY: 8,
		schema: createFontMetrics(SANS_FAMILY, 12, 16, 400),
		textGap: 2,
		title: createFontMetrics(SANS_FAMILY, 18, 22, 600),
		kind: createFontMetrics(SANS_FAMILY, 10, 12, 600),
	}),
	note: Object.freeze({
		padX: 12,
		padY: 6,
		text: createFontMetrics(SANS_FAMILY, 13, 18, 400),
	}),
	row: Object.freeze({
		gap: 8,
		glyph: createFontMetrics(MONO_FAMILY, 12, 14, 400),
		glyphHeight: 14,
		glyphTopOffset: 2,
		glyphWidth: 16,
		maxTypeColumnWidth: 180,
		minNameColumnWidth: 120,
		minTypeColumnWidth: 84,
		name: createFontMetrics(MONO_FAMILY, 16, 20, 500),
		padX: 10,
		padY: 6,
		type: createFontMetrics(MONO_FAMILY, 13, 18, 400),
	}),
	stats: Object.freeze({
		gap: 14,
		padX: 10,
		padY: 5,
		text: createFontMetrics(MONO_FAMILY, 11, 14, 500),
	}),
});

export const tableNodeStyles = Object.freeze({
	header: freezeStyle({
		borderBottomWidth: tableNodeMetrics.sectionBorder,
		gap: tableNodeMetrics.header.gap,
		padding: `${tableNodeMetrics.header.padY}px ${tableNodeMetrics.header.padX}px`,
	}),
	headerGlyph: freezeStyle({
		paddingTop: tableNodeMetrics.header.glyphTopOffset,
	}),
	headerKind: freezeStyle({
		marginLeft: Math.max(
			0,
			tableNodeMetrics.header.kindGap - tableNodeMetrics.header.gap,
		),
		paddingTop: tableNodeMetrics.header.kindTopOffset,
		...tableNodeMetrics.header.kind.style,
	}),
	headerSchema: freezeStyle({
		marginTop: tableNodeMetrics.header.textGap,
		...tableNodeMetrics.header.schema.style,
	}),
	headerTitle: tableNodeMetrics.header.title.style,
	note: freezeStyle({
		borderBottomWidth: tableNodeMetrics.sectionBorder,
		padding: `${tableNodeMetrics.note.padY}px ${tableNodeMetrics.note.padX}px`,
		...tableNodeMetrics.note.text.style,
	}),
	row: freezeStyle({
		gap: tableNodeMetrics.row.gap,
		padding: `${tableNodeMetrics.row.padY}px ${tableNodeMetrics.row.padX}px`,
	}),
	rowKey: freezeStyle({
		paddingTop: tableNodeMetrics.row.glyphTopOffset,
		textAlign: "center",
		...tableNodeMetrics.row.glyph.style,
	}),
	rowName: tableNodeMetrics.row.name.style,
	rowType: freezeStyle({
		textAlign: "right",
		...tableNodeMetrics.row.type.style,
	}),
	stats: freezeStyle({
		borderBottomWidth: tableNodeMetrics.sectionBorder,
		gap: tableNodeMetrics.stats.gap,
		padding: `${tableNodeMetrics.stats.padY}px ${tableNodeMetrics.stats.padX}px`,
		...tableNodeMetrics.stats.text.style,
	}),
});

export function getSchemaColumnRowStyle(
	typeColumnWidth: number,
	showDivider: boolean,
): CSSProperties {
	return {
		...tableNodeStyles.row,
		borderTopStyle: "solid",
		borderTopWidth: showDivider ? tableNodeMetrics.sectionBorder : 0,
		gridTemplateColumns: `${tableNodeMetrics.row.glyphWidth}px minmax(0,1fr) ${typeColumnWidth}px`,
	};
}

