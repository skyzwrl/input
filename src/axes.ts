import { enumKey, isThumbstick } from "./binding";
import { LookAxisConfig, MoveAxisConfig } from "./config";
import { ContextStack, claim, claimKey } from "./context-stack";
import { applyDeadzone, digitalVector } from "./deadzone";
import { AnalogState, ContextState, DIRECTIONS, DirectionState, LookAxisState, MoveAxisState } from "./state";
import { Direction } from "./types";

const MOUSE_MOVEMENT = enumKey(Enum.UserInputType.MouseMovement);
const DEFAULT_DEADZONE = 0.15;
// with these defaults consumeLook returns radians
const DEFAULT_MOUSE_SENSITIVITY = 0.004;
const DEFAULT_STICK_SPEED = 4;

function readDeadzone(name: string, deadzone = DEFAULT_DEADZONE): number {
	if (!(deadzone >= 0 && deadzone < 1)) {
		throw `axis ${name} needs a deadzone in [0, 1), got ${deadzone}`;
	}
	return deadzone;
}

function claimStick(context: ContextState, name: string, stick: Enum.KeyCode): AnalogState {
	if (!isThumbstick(stick)) {
		throw `axis ${name} can only read Thumbstick1 or Thumbstick2, got ${stick.Name}`;
	}
	const state: AnalogState = { kind: "analog", name, context, key: enumKey(stick) };
	claimKey(context, state.key, state);
	return state;
}

export class Axes {
	private readonly moveAxes = new Map<string, MoveAxisState>();
	private readonly lookAxes = new Map<string, LookAxisState>();
	private readonly sticks = new Map<string, Vector3>();

	public constructor(private readonly contexts: ContextStack) {}

	public add(context: ContextState, name: string, config: MoveAxisConfig | LookAxisConfig): void {
		if (this.moveAxes.has(name) || this.lookAxes.has(name)) {
			throw `axis ${name} is defined more than once`;
		}
		if (config.type === "move") {
			this.addMove(context, name, config);
		} else {
			this.addLook(context, name, config);
		}
	}

	public moves(): ReadonlyMap<string, MoveAxisState> {
		return this.moveAxes;
	}

	public move(name: string): MoveAxisState {
		const axis = this.moveAxes.get(name);
		if (axis === undefined) {
			throw `unknown move axis ${name}`;
		}
		return axis;
	}

	// a stick the game is using for its own UI reads as centred, otherwise the character keeps walking
	public setStick(key: string, position: Vector3, gameProcessed: boolean): void {
		if (gameProcessed) {
			this.sticks.delete(key);
		} else {
			this.sticks.set(key, position);
		}
	}

	public clearStick(key: string): void {
		this.sticks.delete(key);
	}

	public addMouseDelta(delta: Vector3): void {
		for (const [, axis] of this.lookAxes) {
			if (axis.mouse !== undefined && this.contexts.receives(axis.mouse, MOUSE_MOVEMENT)) {
				axis.mouseX += delta.X;
				axis.mouseY += delta.Y;
			}
		}
	}

	public reset(): void {
		this.sticks.clear();
		for (const [, axis] of this.lookAxes) {
			axis.mouseX = 0;
			axis.mouseY = 0;
		}
	}

	// x is right and y is forward
	public getMove(name: string): Vector2 {
		const axis = this.move(name);
		const { up, down, left, right } = axis.directions;
		const digital = digitalVector(
			(right.downCount > 0 ? 1 : 0) - (left.downCount > 0 ? 1 : 0),
			(up.downCount > 0 ? 1 : 0) - (down.downCount > 0 ? 1 : 0),
		);

		const position = this.readStick(axis.stick);
		if (position === undefined) {
			return digital;
		}
		const tilt = applyDeadzone(position.X, position.Y, axis.deadzone);
		return tilt.Magnitude > digital.Magnitude ? tilt : digital;
	}

	// x turns right and y looks up. mouse movement since the last call plus stick rate * deltaTime
	public consumeLook(name: string, deltaTime: number): Vector2 {
		const axis = this.look(name);
		let x = axis.mouseX * axis.mouseSensitivity;
		let y = -axis.mouseY * axis.mouseSensitivity;
		axis.mouseX = 0;
		axis.mouseY = 0;

		const position = this.readStick(axis.stick);
		if (position !== undefined) {
			const tilt = applyDeadzone(position.X, position.Y, axis.deadzone);
			x += tilt.X * axis.stickSpeed * deltaTime;
			y += tilt.Y * axis.stickSpeed * deltaTime;
		}
		return new Vector2(x, y);
	}

	private look(name: string): LookAxisState {
		const axis = this.lookAxes.get(name);
		if (axis === undefined) {
			throw `unknown look axis ${name}`;
		}
		return axis;
	}

	private readStick(stick: AnalogState | undefined): Vector3 | undefined {
		return stick !== undefined && this.contexts.receives(stick, stick.key) ? this.sticks.get(stick.key) : undefined;
	}

	private addMove(context: ContextState, name: string, config: MoveAxisConfig): void {
		const directions = {} as Record<Direction, DirectionState>;
		for (const direction of DIRECTIONS) {
			const binding = config[direction];
			const state: DirectionState = {
				kind: "direction",
				name: `${name}.${direction}`,
				context,
				initial: binding,
				binding,
				downCount: 0,
			};
			claim(context, binding, state);
			directions[direction] = state;
		}

		this.moveAxes.set(name, {
			name,
			context,
			directions,
			stick: config.stick !== undefined ? claimStick(context, name, config.stick) : undefined,
			deadzone: readDeadzone(name, config.deadzone),
		});
	}

	private addLook(context: ContextState, name: string, config: LookAxisConfig): void {
		let mouse: AnalogState | undefined;
		if (config.mouse !== false) {
			mouse = { kind: "analog", name, context, key: MOUSE_MOVEMENT };
			claimKey(context, MOUSE_MOVEMENT, mouse);
		}

		this.lookAxes.set(name, {
			mouse,
			stick: config.stick !== undefined ? claimStick(context, name, config.stick) : undefined,
			mouseSensitivity: config.mouseSensitivity ?? DEFAULT_MOUSE_SENSITIVITY,
			stickSpeed: config.stickSpeed ?? DEFAULT_STICK_SPEED,
			deadzone: readDeadzone(name, config.deadzone),
			mouseX: 0,
			mouseY: 0,
		});
	}
}
