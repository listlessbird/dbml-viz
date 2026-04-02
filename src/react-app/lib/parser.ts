import type {
	ColumnData,
	ParseDiagnostic,
	ParsedSchema,
	RefData,
	RefType,
	TableData,
} from "@/types";

const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

const tableIdFromParts = (schemaName: string | null | undefined, tableName: string) =>
	schemaName && schemaName !== "public" ? `${schemaName}.${tableName}` : tableName;

const formatType = (type: {
	schemaName?: string | null;
	type_name?: string | null;
	lengthParam?: number;
	numericParams?: { precision: number; scale?: number };
}): string => {
	const baseName = [type.schemaName, type.type_name].filter(Boolean).join(".");
	const lengthSuffix =
		typeof type.lengthParam === "number" ? `(${type.lengthParam})` : "";
	const numericSuffix =
		type.numericParams && typeof type.numericParams.precision === "number"
			? `(${type.numericParams.precision}${
					typeof type.numericParams.scale === "number"
						? `, ${type.numericParams.scale}`
						: ""
				})`
			: "";

	return `${baseName || "unknown"}${lengthSuffix || numericSuffix}`;
};

const relationPairToType = (from: string, to: string): RefType => {
	if (from === "1" && to === "1") {
		return "one_to_one";
	}
	if (from === "1" && to === "*") {
		return "one_to_many";
	}
	if (from === "*" && to === "*") {
		return "many_to_many";
	}
	return "many_to_one";
};

const normalizeDiagnostics = (error: unknown): ParseDiagnostic[] => {
	if (
		typeof error === "object" &&
		error !== null &&
		"diags" in error &&
		Array.isArray(error.diags)
	) {
		return error.diags.map((diag) => ({
			message:
				typeof diag?.message === "string" ? diag.message : "Error parsing statement(s).",
			code: typeof diag?.code === "number" ? diag.code : undefined,
			location:
				diag?.location &&
				typeof diag.location === "object" &&
				diag.location.start &&
				typeof diag.location.start.line === "number" &&
				typeof diag.location.start.column === "number"
					? {
							start: {
								line: diag.location.start.line,
								column: diag.location.start.column,
							},
							end:
								diag.location.end &&
								typeof diag.location.end.line === "number" &&
								typeof diag.location.end.column === "number"
									? {
											line: diag.location.end.line,
											column: diag.location.end.column,
										}
									: undefined,
						}
					: undefined,
		}));
	}

	return [
		{
			message: error instanceof Error ? error.message : "Error parsing statement(s).",
		},
	];
};

export class DbmlParseError extends Error {
	readonly diagnostics: readonly ParseDiagnostic[];

	constructor(diagnostics: readonly ParseDiagnostic[]) {
		super("Error parsing statement(s).");
		this.name = "DbmlParseError";
		this.diagnostics = diagnostics;
	}
}

let parserModulePromise: Promise<typeof import("@dbml/core")> | null = null;

const loadParserModule = () => {
	if (parserModulePromise === null) {
		parserModulePromise = import("@dbml/core");
	}

	return parserModulePromise;
};

export const parseDbml = async (dbml: string): Promise<ParsedSchema> => {
	if (dbml.trim().length === 0) {
		return EMPTY_SCHEMA;
	}

	try {
		const { Parser } = await loadParserModule();
		const exported = Parser.parse(dbml, "dbmlv2").export();
		const outgoingForeignKeys = new Set<string>();
		const refs: RefData[] = [];

		for (const schema of exported.schemas) {
			for (const ref of schema.refs) {
				const [fromEndpoint, toEndpoint] = ref.endpoints;
				if (!fromEndpoint || !toEndpoint) {
					continue;
				}

				const fromTableId = tableIdFromParts(
					fromEndpoint.schemaName ?? schema.name,
					fromEndpoint.tableName,
				);
				const toTableId = tableIdFromParts(
					toEndpoint.schemaName ?? schema.name,
					toEndpoint.tableName,
				);
				const fromColumn = fromEndpoint.fieldNames[0];
				const toColumn = toEndpoint.fieldNames[0];

				if (!fromColumn || !toColumn) {
					continue;
				}

				outgoingForeignKeys.add(`${fromTableId}:${fromColumn}`);
				refs.push({
					id: `${fromTableId}:${fromColumn}->${toTableId}:${toColumn}:${refs.length}`,
					from: {
						table: fromTableId,
						column: fromColumn,
					},
					to: {
						table: toTableId,
						column: toColumn,
					},
					type: relationPairToType(fromEndpoint.relation, toEndpoint.relation),
				});
			}
		}

		const tables: TableData[] = exported.schemas.flatMap((schema) =>
			schema.tables.map((table) => {
				const tableId = tableIdFromParts(schema.name, table.name);
				const columns: ColumnData[] = table.fields.map((field) => ({
					name: field.name,
					type: formatType(field.type),
					pk: Boolean(field.pk),
					notNull: Boolean(field.not_null),
					unique: Boolean(field.unique),
					isForeignKey: outgoingForeignKeys.has(`${tableId}:${field.name}`),
					note: field.note ?? undefined,
				}));

				return {
					id: tableId,
					name: table.name,
					schema: schema.name === "public" ? undefined : schema.name,
					note: table.note ?? undefined,
					columns,
				};
			}),
		);

		return {
			tables,
			refs,
			errors: [],
		};
	} catch (error) {
		throw new DbmlParseError(normalizeDiagnostics(error));
	}
};
