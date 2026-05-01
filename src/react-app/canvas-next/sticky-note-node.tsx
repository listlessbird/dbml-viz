import {
	Handle,
	NodeResizer,
	Position,
	type NodeProps,
} from "@xyflow/react";
import {
	memo,
	useCallback,
	type ChangeEvent,
	type CSSProperties,
} from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import type { StickyNoteColor, StickyNoteNode as StickyNoteNodeType } from "@/types";

const colorClasses: Record<StickyNoteColor, string> = {
	yellow: "border-yellow-300 bg-yellow-100 text-yellow-950",
	pink: "border-pink-300 bg-pink-100 text-pink-950",
	blue: "border-sky-300 bg-sky-100 text-sky-950",
	green: "border-emerald-300 bg-emerald-100 text-emerald-950",
};

const handleStyle: CSSProperties = {
	top: "50%",
	right: 0,
	transform: "translate(50%, -50%)",
	width: 1,
	height: 1,
	minWidth: 0,
	minHeight: 0,
	border: "none",
	background: "transparent",
	opacity: 0,
	pointerEvents: "none",
};

export const CanvasNextStickyNoteNode = memo(function CanvasNextStickyNoteNode({
	id,
	data,
	selected,
	width,
	height,
}: NodeProps<StickyNoteNodeType>) {
	const note = data.note;
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);
	const handleTextChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			updateStickyNote(id, { text: event.currentTarget.value });
		},
		[id, updateStickyNote],
	);

	if (!note) return null;

	return (
		<div
			data-color={note.color}
			data-selected={selected}
			className={`flex h-full min-h-24 w-full min-w-36 flex-col overflow-hidden border shadow-sm ${colorClasses[note.color]}`}
			style={{
				width: width ?? note.width,
				height: height ?? note.height,
			}}
		>
			<NodeResizer
				isVisible={selected}
				minWidth={120}
				minHeight={90}
				lineClassName="border-primary"
				handleClassName="border-primary bg-background"
				onResizeEnd={(_, params) => {
					updateStickyNote(id, {
						width: params.width,
						height: params.height,
					});
				}}
			/>
			<Handle
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={handleStyle}
			/>
			<textarea
				value={note.text}
				onChange={handleTextChange}
				className="nodrag nowheel h-full w-full resize-none bg-transparent p-3 text-sm leading-5 outline-none placeholder:text-current/45"
				placeholder="Sticky note"
			/>
		</div>
	);
});
