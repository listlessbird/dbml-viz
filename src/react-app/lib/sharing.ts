import { parseSchemaPayload } from "@/lib/schema-payload";
import type { SchemaPayload } from "@/types";

interface ShareResponse {
	readonly id: string;
}

const readErrorMessage = async (response: Response) => {
	try {
		const json = (await response.json()) as { error?: string };
		return json.error ?? `Request failed with status ${response.status}`;
	} catch {
		return `Request failed with status ${response.status}`;
	}
};

export const loadSharedSchema = async (id: string): Promise<SchemaPayload> => {
	const response = await fetch(`/api/load/${id}`);

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const payload = parseSchemaPayload(await response.json());
	if (payload === null) {
		throw new Error("Shared schema payload is invalid.");
	}

	return payload;
};

export const saveSharedSchema = async (
	payload: SchemaPayload,
): Promise<ShareResponse> => {
	const response = await fetch("/api/save", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	return (await response.json()) as ShareResponse;
};
