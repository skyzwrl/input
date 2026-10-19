import { Binding, Device } from "./binding";

export type ActionPhase = "began" | "ended" | "held" | "tapped" | "doubleTapped";
export type Direction = "up" | "down" | "left" | "right";

export interface ActionEvent<A extends string = string> {
	readonly action: A;
	readonly phase: ActionPhase;
	readonly binding: Binding;
	readonly device: Device;
	readonly time: number;
	readonly heldFor: number;
	// ended because its context stopped seeing the input (popped, covered), not because it was released
	readonly cancelled: boolean;
}

// InputObject satisfies this, tests pass plain tables
export interface InputLike {
	readonly KeyCode: Enum.KeyCode;
	readonly UserInputType: Enum.UserInputType;
	readonly Position: Vector3;
	readonly Delta: Vector3;
}

export interface InputOptions {
	readonly clock?: () => number;
	readonly device?: Device;
	/** stick tilt below this doesn't switch the device to gamepad, so a drifting stick can't flip prompts */
	readonly stickDrift?: number;
}

export interface RebindOptions {
	/** binding to replace, defaults to the action's first binding on the same device */
	readonly replace?: Binding;
	/** give whatever already uses the binding the replaced one instead of failing */
	readonly swap?: boolean;
}

export type RebindResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: "Invalid" }
	| { readonly ok: false; readonly reason: "Conflict"; readonly conflict: string };
