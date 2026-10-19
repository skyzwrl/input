import { Binding, Device } from "./binding";
import { SinkMode } from "./config";
import { ActionEvent, ActionPhase, Direction } from "./types";

export type Listener = (event: ActionEvent) => void;

export interface ContextState {
	readonly name: string;
	readonly priority: number;
	readonly sink: SinkMode;
	readonly targets: Map<string, Target>;
	pushes: number;
}

export interface ActionState {
	readonly kind: "action";
	readonly name: string;
	readonly context: ContextState;
	readonly defaults: readonly Binding[];
	readonly hold?: number;
	readonly doubleTap?: number;
	readonly listeners: Map<ActionPhase, Listener[]>;
	bindings: Binding[];
	downCount: number;
	downAt: number;
	downBinding?: Binding;
	downDevice: Device;
	heldFired: boolean;
	lastPressAt: number;
}

export interface DirectionState {
	readonly kind: "direction";
	readonly name: string;
	readonly context: ContextState;
	readonly initial: Binding;
	binding: Binding;
	downCount: number;
}

// sticks and mouse movement are read when asked for rather than pressed and released
export interface AnalogState {
	readonly kind: "analog";
	readonly name: string;
	readonly context: ContextState;
	readonly key: string;
}

export interface MoveAxisState {
	readonly name: string;
	readonly context: ContextState;
	readonly directions: Record<Direction, DirectionState>;
	readonly stick?: AnalogState;
	readonly deadzone: number;
}

export interface LookAxisState {
	readonly mouse?: AnalogState;
	readonly stick?: AnalogState;
	readonly mouseSensitivity: number;
	readonly stickSpeed: number;
	readonly deadzone: number;
	mouseX: number;
	mouseY: number;
}

export type Target = ActionState | DirectionState | AnalogState;
export type Rebindable = ActionState | DirectionState;

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];
