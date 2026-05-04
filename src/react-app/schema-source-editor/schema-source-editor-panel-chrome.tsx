import type { ParseDiagnostic, SchemaSourceMetadata, SqlDialect } from "@/types";

const SQL_DIALECTS: ReadonlyArray<{
	readonly value: SqlDialect;
	readonly label: string;
}> = [
	{ value: "postgres", label: "Postgres" },
	{ value: "mysql", label: "MySQL" },
	{ value: "mssql", label: "SQL Server" },
	{ value: "oracle", label: "Oracle" },
	{ value: "snowflake", label: "Snowflake" },
];

const formatDiagnosticLocation = (diagnostic: ParseDiagnostic) => {
	const start = diagnostic.location?.start;
	if (!start) return "Source";
	return `Line ${start.line}, column ${start.column}`;
};

export function SchemaSourceMetadataControls({
	metadata,
	onMetadataChange,
}: {
	readonly metadata: SchemaSourceMetadata;
	readonly onMetadataChange: (metadata: SchemaSourceMetadata) => void;
}) {
	const activeDialect = metadata.format === "sql"
		? (metadata.dialect ?? "postgres")
		: "postgres";

	return (
		<div className="flex shrink-0 items-center gap-2">
			<div
				className="inline-flex overflow-hidden rounded-sm border border-border"
				aria-label="Schema source format"
			>
				<button
					type="button"
					className="h-7 px-2 text-xs font-medium data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
					data-active={metadata.format === "dbml"}
					onClick={() => onMetadataChange({ format: "dbml" })}
				>
					DBML
				</button>
				<button
					type="button"
					className="h-7 border-l border-border px-2 text-xs font-medium data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
					data-active={metadata.format === "sql"}
					onClick={() =>
						onMetadataChange({ format: "sql", dialect: activeDialect })
					}
				>
					SQL
				</button>
			</div>
			{metadata.format === "sql" ? (
				<select
					aria-label="SQL dialect"
					className="h-7 rounded-sm border border-border bg-background px-2 text-xs"
					value={activeDialect}
					onChange={(event) =>
						onMetadataChange({
							format: "sql",
							dialect: event.currentTarget.value as SqlDialect,
						})
					}
				>
					{SQL_DIALECTS.map((dialect) => (
						<option key={dialect.value} value={dialect.value}>
							{dialect.label}
						</option>
					))}
				</select>
			) : null}
		</div>
	);
}

export function SchemaSourceDiagnosticsSummary({
	diagnostics,
}: {
	readonly diagnostics: readonly ParseDiagnostic[];
}) {
	if (diagnostics.length === 0) return null;

	return (
		<div
			data-testid="schema-source-diagnostics"
			className="max-h-36 shrink-0 overflow-auto border-t border-border bg-destructive/5 px-3 py-2"
		>
			<ul className="space-y-1">
				{diagnostics.slice(0, 3).map((diagnostic, index) => (
					<li key={index} className="text-xs text-foreground">
						<span className="font-medium text-destructive">
							{formatDiagnosticLocation(diagnostic)}
						</span>
						<span className="text-muted-foreground"> / </span>
						<span>{diagnostic.message}</span>
					</li>
				))}
			</ul>
			{diagnostics.length > 3 ? (
				<p className="mt-1 text-xs text-muted-foreground">
					{diagnostics.length - 3} more diagnostics
				</p>
			) : null}
		</div>
	);
}
