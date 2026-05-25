import { hc } from "hono/client";
import type { InferRequestType, InferResponseType } from "hono/client";

import type { AppType } from "../../worker/app";
import type { SchemaPayload } from "@/types";
import { getOrCreateDeviceId } from "./device-workspace";

const api = hc<AppType>("/");
const SHARE_DEVICE_ID_HEADER = "x-dbml-viz-device-id";

const loadSharedSchemaRequest = api.api.load[":id"].$get;
const saveSharedSchemaPath = "/api/save";

type LoadSharedSchemaResponse = InferResponseType<typeof loadSharedSchemaRequest, 200>;
type SaveSharedSchemaRequest = InferRequestType<typeof api.api.save.$post>["json"];
type SaveSharedSchemaResponse = InferResponseType<typeof api.api.save.$post, 201>;
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
	const response = await fetch(saveSharedSchemaPath, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			[SHARE_DEVICE_ID_HEADER]: getOrCreateDeviceId(),
		},
		body: JSON.stringify(requestPayload),
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	return await response.json();
};
