import { virtual } from "../binding";
import { ActionName, InputConfig } from "../config";
import { ActionPhase, InputLike, InputMap, InputOptions } from "../input-map";

export function key(keyCode: Enum.KeyCode): InputLike {
	return {
		KeyCode: keyCode,
		UserInputType: Enum.UserInputType.Keyboard,
		Position: Vector3.zero,
		Delta: Vector3.zero,
	};
}

export function pad(keyCode: Enum.KeyCode): InputLike {
	return {
		KeyCode: keyCode,
		UserInputType: Enum.UserInputType.Gamepad1,
		Position: Vector3.zero,
		Delta: Vector3.zero,
	};
}

export function click(button: Enum.UserInputType): InputLike {
	return { KeyCode: Enum.KeyCode.None, UserInputType: button, Position: Vector3.zero, Delta: Vector3.zero };
}

export function stick(keyCode: Enum.KeyCode, x: number, y: number): InputLike {
	return {
		KeyCode: keyCode,
		UserInputType: Enum.UserInputType.Gamepad1,
		Position: new Vector3(x, y, 0),
		Delta: Vector3.zero,
	};
}

export function mouseMove(dx: number, dy: number): InputLike {
	return {
		KeyCode: Enum.KeyCode.None,
		UserInputType: Enum.UserInputType.MouseMovement,
		Position: Vector3.zero,
		Delta: new Vector3(dx, dy, 0),
	};
}

export function screenTouch(): InputLike {
	return {
		KeyCode: Enum.KeyCode.None,
		UserInputType: Enum.UserInputType.Touch,
		Position: Vector3.zero,
		Delta: Vector3.zero,
	};
}

export function createClock() {
	let now = 0;
	return {
		read: () => now,
		advance: (seconds: number) => {
			now += seconds;
		},
	};
}

export function createInput(options?: InputOptions) {
	return new InputMap(
		{
			contexts: {
				gameplay: {
					priority: 0,
					actions: {
						attack: [Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR2, virtual("Attack")],
						heavy: { bindings: [Enum.KeyCode.R, Enum.KeyCode.ButtonY], hold: 0.5 },
						dash: { bindings: [Enum.KeyCode.Q, Enum.KeyCode.ButtonB], doubleTap: 0.3 },
						block: [Enum.KeyCode.F, Enum.KeyCode.ButtonL2],
						openMenu: [Enum.KeyCode.M, Enum.KeyCode.ButtonStart],
					},
					axes: {
						move: {
							type: "move",
							up: Enum.KeyCode.W,
							down: Enum.KeyCode.S,
							left: Enum.KeyCode.A,
							right: Enum.KeyCode.D,
							stick: Enum.KeyCode.Thumbstick1,
						},
						look: { type: "look", stick: Enum.KeyCode.Thumbstick2, mouseSensitivity: 0.01, stickSpeed: 2 },
					},
				},
				emotes: {
					priority: 2,
					sink: "none",
					actions: { wave: [Enum.KeyCode.F] },
				},
				vehicle: {
					priority: 5,
					actions: { boost: [Enum.KeyCode.LeftShift], honk: [Enum.KeyCode.F] },
					axes: {
						steer: {
							type: "move",
							up: Enum.KeyCode.Up,
							down: Enum.KeyCode.Down,
							left: Enum.KeyCode.Left,
							right: Enum.KeyCode.Right,
							stick: Enum.KeyCode.Thumbstick1,
						},
					},
				},
				menu: {
					priority: 10,
					sink: "all",
					actions: {
						back: [Enum.KeyCode.Escape, Enum.KeyCode.ButtonB],
						confirm: [Enum.KeyCode.Return, Enum.KeyCode.ButtonA],
					},
				},
			},
			active: ["gameplay"],
		},
		options,
	);
}

const PHASES: ActionPhase[] = ["began", "held", "tapped", "doubleTapped", "ended"];

// collects "phase" or "phase:cancelled" strings for an action
export function recordPhases<C extends InputConfig>(input: InputMap<C>, action: ActionName<C>): string[] {
	const phases: string[] = [];
	for (const phase of PHASES) {
		input.on(action, phase, (event) => phases.push(event.cancelled ? `${phase}:cancelled` : phase));
	}
	return phases;
}
