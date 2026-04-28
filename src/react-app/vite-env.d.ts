/// <reference types="vite/client" />

declare module "@tabler-icon/shared" {
	import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

	const Icon: ForwardRefExoticComponent<
		Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
	>;
	export default Icon;
}

declare module "@tabler-icon/IconAlertOctagon.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconAlertTriangle.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconBinaryTree2.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconBorderNone.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconBrandGithub.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconCheck.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconChevronDown.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconChevronLeft.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconChevronRight.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconChevronUp.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconCircleCheck.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconCopy.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconCornerDownLeft.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconDots.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconFocus2.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconGridDots.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconHandMove.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconInfoCircle.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLayoutGrid.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLayoutSidebar.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLayoutSidebarLeftCollapse.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLayoutSidebarLeftExpand.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLoader.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLock.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconLockOpen.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconMinus.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconNote.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconPlus.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconSearch.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconSelector.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconShare2.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconTrash.mjs" { export { default } from "@tabler-icon/shared"; }
declare module "@tabler-icon/IconX.mjs" { export { default } from "@tabler-icon/shared"; }
