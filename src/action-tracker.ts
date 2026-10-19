import { Binding, Device } from "./binding";
import { ActionConfig } from "./config";
import { claim } from "./context-stack";
import { ActionState, ContextState, Listener } from "./state";
import { ActionEvent, ActionPhase } from "./types";

function isActionConfig(config: readonly Binding[] | ActionConfig): config is ActionConfig {
	return (config as ActionConfig).bindings !== undefined;
}

export class ActionTracker {
	private readonly actions = new Map<string, ActionState>();
	private readonly pendingHolds = new Set<ActionState>();
	private readonly dueHolds = new Array<ActionState>();

	public constructor(private readonly clock: () => number) {}

	public add(context: ContextState, name: string, config: readonly Binding[] | ActionConfig, device: Device): void {
		if (this.actions.has(name)) {
			throw `action ${name} is defined in more than one context`;
		}
		const settings: ActionConfig = isActionConfig(config) ? config : { bindings: config };
		if (settings.hold !== undefined && !(settings.hold > 0)) {
			throw `action ${name} needs a positive hold time`;
		}
		if (settings.doubleTap !== undefined && !(settings.doubleTap > 0)) {
			throw `action ${name} needs a positive double tap window`;
		}

		const action: ActionState = {
			kind: "action",
			name,
			context,
			defaults: [...settings.bindings],
			hold: settings.hold,
			doubleTap: settings.doubleTap,
			listeners: new Map(),
			bindings: [...settings.bindings],
			downCount: 0,
			downAt: 0,
			downDevice: device,
			heldFired: false,
			lastPressAt: -math.huge,
		};
		for (const binding of action.bindings) {
			claim(context, binding, action);
		}
		this.actions.set(name, action);
	}

	public all(): ReadonlyMap<string, ActionState> {
		return this.actions;
	}

	public named(name: string): ActionState {
		const action = this.actions.get(name);
		if (action === undefined) {
			throw `unknown action ${name}`;
		}
		return action;
	}

	public on(name: string, phase: ActionPhase, listener: Listener): () => void {
		const listeners = this.named(name).listeners;
		let list = listeners.get(phase);
		if (list === undefined) {
			list = [];
			listeners.set(phase, list);
		}

		list.push(listener);
		return () => {
			const index = list.indexOf(listener);
			if (index !== -1) {
				list.remove(index);
			}
		};
	}

	public isDown(name: string): boolean {
		return this.named(name).downCount > 0;
	}

	public holdProgress(name: string): number {
		const action = this.named(name);
		if (action.downCount === 0 || action.hold === undefined) {
			return 0;
		}
		return math.clamp((this.clock() - action.downAt) / action.hold, 0, 1);
	}

	public press(action: ActionState, binding: Binding, device: Device, now: number): void {
		action.downCount += 1;
		if (action.downCount > 1) {
			return;
		}

		action.downAt = now;
		action.downBinding = binding;
		action.downDevice = device;
		action.heldFired = false;

		const doubleTap = action.doubleTap;
		const doubleTapped = doubleTap !== undefined && now - action.lastPressAt <= doubleTap;
		// a double tap uses up both presses, so a quick third press starts a new pair
		action.lastPressAt = doubleTapped ? -math.huge : now;

		if (action.hold !== undefined) {
			this.pendingHolds.add(action);
		}
		this.emit(action, "began", now, 0, false);
		if (doubleTapped) {
			this.emit(action, "doubleTapped", now, 0, false);
		}
	}

	public release(action: ActionState, now: number, cancelled: boolean): void {
		if (action.downCount === 0) {
			return;
		}
		action.downCount -= 1;
		if (action.downCount > 0) {
			return;
		}

		this.pendingHolds.delete(action);
		const heldFor = now - action.downAt;
		const hold = action.hold;
		if (hold !== undefined && !cancelled && !action.heldFired) {
			if (heldFor >= hold) {
				// the threshold passed between updates, held still comes before the release
				action.heldFired = true;
				this.emit(action, "held", now, heldFor, false);
			} else {
				this.emit(action, "tapped", now, heldFor, false);
			}
		}
		this.emit(action, "ended", now, heldFor, cancelled);
	}

	public update(): void {
		if (this.pendingHolds.isEmpty()) {
			return;
		}

		const now = this.clock();
		const due = this.dueHolds;
		for (const action of this.pendingHolds) {
			if (now - action.downAt >= action.hold!) {
				due.push(action);
			}
		}
		for (const action of due) {
			this.pendingHolds.delete(action);
			action.heldFired = true;
			this.emit(action, "held", now, now - action.downAt, false);
		}
		due.clear();
	}

	private emit(action: ActionState, phase: ActionPhase, time: number, heldFor: number, cancelled: boolean): void {
		const listeners = action.listeners.get(phase);
		if (listeners === undefined || listeners.isEmpty()) {
			return;
		}

		const event: ActionEvent = {
			action: action.name,
			phase,
			binding: action.downBinding!,
			device: action.downDevice,
			time,
			heldFor,
			cancelled,
		};
		for (const listener of table.clone(listeners)) {
			listener(event);
		}
	}
}
