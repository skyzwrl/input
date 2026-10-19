import { Binding } from "./binding";

// bound: inputs this context binds stop here. all: nothing below sees any input (menus, cutscenes).
// none: inputs reach lower contexts too
export type SinkMode = "bound" | "all" | "none";

export interface ActionConfig {
	readonly bindings: readonly Binding[];
	/** seconds an action must stay down before "held" fires */
	readonly hold?: number;
	/** max seconds between two presses for "doubleTapped" */
	readonly doubleTap?: number;
}

export interface MoveAxisConfig {
	readonly type: "move";
	readonly up: Binding;
	readonly down: Binding;
	readonly left: Binding;
	readonly right: Binding;
	readonly stick?: Enum.KeyCode;
	readonly deadzone?: number;
}

export interface LookAxisConfig {
	readonly type: "look";
	readonly mouse?: boolean;
	readonly mouseSensitivity?: number;
	readonly stick?: Enum.KeyCode;
	/** look units per second with the stick fully pushed */
	readonly stickSpeed?: number;
	readonly deadzone?: number;
}

export interface ContextConfig {
	readonly priority: number;
	readonly sink?: SinkMode;
	readonly actions?: { readonly [action: string]: readonly Binding[] | ActionConfig };
	readonly axes?: { readonly [axis: string]: MoveAxisConfig | LookAxisConfig };
}

export interface InputConfig {
	readonly contexts: { readonly [context: string]: ContextConfig };
	readonly active?: readonly string[];
}

type Contexts<C extends InputConfig> = C["contexts"];
type ActionsOf<T> = T extends { readonly actions: infer A } ? keyof A : never;
type AxesOf<T, Kind> = T extends { readonly axes: infer A }
	? { [K in keyof A]: A[K] extends { readonly type: Kind } ? K : never }[keyof A]
	: never;

export type ContextName<C extends InputConfig> = keyof Contexts<C> & string;
export type ActionName<C extends InputConfig> = {
	[K in keyof Contexts<C>]: ActionsOf<Contexts<C>[K]>;
}[keyof Contexts<C>] &
	string;
export type MoveAxisName<C extends InputConfig> = {
	[K in keyof Contexts<C>]: AxesOf<Contexts<C>[K], "move">;
}[keyof Contexts<C>] &
	string;
export type LookAxisName<C extends InputConfig> = {
	[K in keyof Contexts<C>]: AxesOf<Contexts<C>[K], "look">;
}[keyof Contexts<C>] &
	string;
