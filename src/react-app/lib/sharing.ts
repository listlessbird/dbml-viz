import { hc } from "hono/client";
import type { InferRequestType, InferResponseType } from "hono/client";

import type { AppType } from "../../worker/app";
import type { SchemaPayload } from "@/types";

const api = hc<AppType>("/");

const loadSharedSchemaRequest = api.api.load[":id"].$get;
const saveSharedSchemaRequest = api.api.save.$post;

type LoadSharedSchemaResponse = InferResponseType<typeof loadSharedSchemaRequest, 200>;
type SaveSharedSchemaRequest = InferRequestType<typeof saveSharedSchemaRequest>["json"];
type SaveSharedSchemaResponse = InferResponseType<typeof saveSharedSchemaRequest, 201>;
type ShareErrorResponse = { readonly error?: string };
type JsonErrorResponse = Pick<Response, "json" | "status">;

const readErrorMessage = async (response: JsonErrorResponse) => {
	try {
		const json = (await response.json()) as ShareErrorResponse;
		return json.error ?? `Request failed with status ${response.status}`;
	} catch {
		return `Request failed with status ${response.status}`;
	}
};

export const loadSharedSchema = async (id: string): Promise<SchemaPayload> => {
	const response = await loadSharedSchemaRequest({ param: { id } });

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const payload = (await response.json()) satisfies LoadSharedSchemaResponse;
	return payload;
};

export const saveSharedSchema = async (
	payload: SchemaPayload,
): Promise<SaveSharedSchemaResponse> => {
	const requestPayload: SaveSharedSchemaRequest = {
		...payload,
		notes: [...payload.notes],
	};
	const response = await saveSharedSchemaRequest({
		json: requestPayload,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	return await response.json();
};
