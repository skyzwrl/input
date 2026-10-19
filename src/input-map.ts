import { ActionTracker } from "./action-tracker";
import { Axes } from "./axes";
import {
	Binding,
	Device,
	bindingKey,
	deviceOfBinding,
	deviceOfInputType,
	enumKey,
	isMouseButton,
	isThumbstick,
	virtual,
} from "./binding";
import { ActionName, ContextName, InputConfig, LookAxisName, MoveAxisName } from "./config";
import { ContextStack } from "./context-stack";
import { DeviceWatcher } from "./device";
import { rebindAction, rebindDirection, resetAction, resetBindings } from "./rebinding";
import { SavedBindings, loadBindings, saveBindings } from "./saved-bindings";
import { Listener, Target } from "./state";
import { ActionEvent, ActionPhase, Direction, InputLike, InputOptions, RebindOptions, RebindResult } from "./types";

export type {
	ActionEvent,
	ActionPhase,
	Direction,
	InputLike,
	InputOptions,
	RebindOptions,
	RebindResult,
} from "./types";

function inputKey(input: InputLike): string | undefined {
	const inputType = input.UserInputType;
	if (isMouseButton(inputType)) {
		return enumKey(inputType);
	}
	return input.KeyCode !== Enum.KeyCode.None ? enumKey(input.KeyCode) : undefined;
}

export class InputMap<const C extends InputConfig> {
	private readonly devices: DeviceWatcher;
	private readonly actions: ActionTracker;
	private readonly contexts: ContextStack;
	private readonly axes: Axes;

	public constructor(config: C, options: InputOptions = {}) {
		const clock = options.clock ?? os.clock;
		this.devices = new DeviceWatcher(options.device ?? "KeyboardMouse", options.stickDrift ?? 0.2);
		this.actions = new ActionTracker(clock);
		this.contexts = new ContextStack(
			clock,
			(target, binding, device, now) => this.pressTarget(target, binding, device, now),
			(target, now, cancelled) => this.releaseTarget(target, now, cancelled),
		);
		this.axes = new Axes(this.contexts);

		for (const [name, contextConfig] of pairs(config.contexts as InputConfig["contexts"])) {
			const context = this.contexts.add(name as string, contextConfig.priority, contextConfig.sink ?? "bound");
			if (contextConfig.actions !== undefined) {
				for (const [action, actionConfig] of pairs(contextConfig.actions)) {
					this.actions.add(context, action as string, actionConfig, this.devices.get());
				}
			}
			if (contextConfig.axes !== undefined) {
				for (const [axis, axisConfig] of pairs(contextConfig.axes)) {
					this.axes.add(context, axis as string, axisConfig);
				}
			}
		}
		this.contexts.activate(config.active ?? []);
	}

	public began(input: InputLike, gameProcessed = false): void {
		this.devices.note(input);
		const key = inputKey(input);
		if (key === undefined) {
			return;
		}
		if (isThumbstick(input.KeyCode)) {
			this.axes.setStick(key, input.Position, gameProcessed);
			return;
		}
		if (gameProcessed) {
			return;
		}
		const binding = isMouseButton(input.UserInputType) ? input.UserInputType : input.KeyCode;
		this.contexts.press(key, binding, deviceOfInputType(input.UserInputType) ?? this.devices.get());
	}

	public changed(input: InputLike, gameProcessed = false): void {
		this.devices.note(input);
		if (isThumbstick(input.KeyCode)) {
			this.axes.setStick(enumKey(input.KeyCode), input.Position, gameProcessed);
		} else if (input.UserInputType === Enum.UserInputType.MouseMovement && !gameProcessed) {
			this.axes.addMouseDelta(input.Delta);
		}
	}

	// releases ignore gameProcessed, an input always lets go of whatever took its press
	public ended(input: InputLike): void {
		const key = inputKey(input);
		if (key === undefined) {
			return;
		}
		if (isThumbstick(input.KeyCode)) {
			this.axes.clearStick(key);
		} else {
			this.contexts.release(key);
		}
	}

	public pressVirtual(name: string): void {
		this.devices.set("Touch");
		const button = virtual(name);
		this.contexts.press(bindingKey(button), button, "Touch");
	}

	public releaseVirtual(name: string): void {
		this.contexts.release(bindingKey(virtual(name)));
	}

	public releaseAll(): void {
		this.axes.reset();
		this.contexts.releaseAll();
	}

	public update(): void {
		this.actions.update();
	}

	public on(
		action: ActionName<C>,
		phase: ActionPhase,
		listener: (event: ActionEvent<ActionName<C>>) => void,
	): () => void {
		// stored loosely typed, a listener only ever receives events for the action it was added to
		return this.actions.on(action, phase, listener as unknown as Listener);
	}

	public isDown(action: ActionName<C>): boolean {
		return this.actions.isDown(action);
	}

	// 0..1 towards the hold threshold, for charge bars
	public holdProgress(action: ActionName<C>): number {
		return this.actions.holdProgress(action);
	}

	public push(context: ContextName<C>): () => void {
		return this.contexts.push(context);
	}

	public isActive(context: ContextName<C>): boolean {
		return this.contexts.isActive(context);
	}

	public getMove(axis: MoveAxisName<C>): Vector2 {
		return this.axes.getMove(axis);
	}

	public consumeLook(axis: LookAxisName<C>, deltaTime: number): Vector2 {
		return this.axes.consumeLook(axis, deltaTime);
	}

	public getDevice(): Device {
		return this.devices.get();
	}

	public onDeviceChanged(listener: (device: Device) => void): () => void {
		return this.devices.onChanged(listener);
	}

	public getBindings(action: ActionName<C>): Binding[] {
		return [...this.actions.named(action).bindings];
	}

	// for button prompts: the first binding usable on the device
	public getBindingFor(action: ActionName<C>, device = this.devices.get()): Binding | undefined {
		return this.actions.named(action).bindings.find((binding) => deviceOfBinding(binding) === device);
	}

	public getMoveBinding(axis: MoveAxisName<C>, direction: Direction): Binding {
		return this.axes.move(axis).directions[direction].binding;
	}

	public rebind(action: ActionName<C>, binding: Binding, options: RebindOptions = {}): RebindResult {
		return rebindAction(this.actions.named(action), binding, options);
	}

	public rebindMove(axis: MoveAxisName<C>, direction: Direction, binding: Binding, swap = false): RebindResult {
		return rebindDirection(this.axes.move(axis).directions[direction], binding, swap);
	}

	public resetAction(action: ActionName<C>): RebindResult {
		return resetAction(this.actions.named(action));
	}

	public resetAll(): void {
		resetBindings(this.contexts.all(), this.actions.all(), this.axes.moves());
	}

	public saveBindings(): SavedBindings {
		return saveBindings(this.actions.all(), this.axes.moves());
	}

	// starts from the defaults and returns what couldn't be applied
	public loadBindings(data: unknown): string[] {
		this.resetAll();
		return loadBindings(data, this.actions.all(), this.axes.moves());
	}

	private pressTarget(target: Target, binding: Binding, device: Device, now: number): void {
		if (target.kind === "action") {
			this.actions.press(target, binding, device, now);
		} else if (target.kind === "direction") {
			target.downCount += 1;
		}
	}

	private releaseTarget(target: Target, now: number, cancelled: boolean): void {
		if (target.kind === "action") {
			this.actions.release(target, now, cancelled);
		} else if (target.kind === "direction") {
			target.downCount = math.max(target.downCount - 1, 0);
		}
	}
}
