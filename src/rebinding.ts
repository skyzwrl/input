import { Binding, bindingKey, deviceOfBinding, isBindable } from "./binding";
import { ActionState, ContextState, DIRECTIONS, DirectionState, MoveAxisState, Rebindable } from "./state";
import { RebindOptions, RebindResult } from "./types";

const OK: RebindResult = { ok: true };
const INVALID: RebindResult = { ok: false, reason: "Invalid" };

// undefined from appends, undefined to removes. directions always have a binding, assign makes sure of that
function swapBinding(target: Rebindable, from: Binding | undefined, to: Binding | undefined): void {
	if (target.kind === "direction") {
		target.binding = to!;
		return;
	}

	const index = from !== undefined ? target.bindings.indexOf(from) : -1;
	if (index === -1) {
		if (to !== undefined) {
			target.bindings.push(to);
		}
	} else if (to !== undefined) {
		target.bindings[index] = to;
	} else {
		target.bindings.remove(index);
	}
}

// target takes binding in place of replaced; whatever owned binding gets replaced when swapping
function assign(target: Rebindable, binding: Binding, replaced: Binding | undefined, swap: boolean): RebindResult {
	const context = target.context;
	const key = bindingKey(binding);
	// bindable keys never collide with the stick and mouse movement entries
	const owner = context.targets.get(key) as Rebindable | undefined;
	if (owner === target) {
		return OK;
	}
	if (owner !== undefined && (!swap || (replaced === undefined && owner.kind === "direction"))) {
		return { ok: false, reason: "Conflict", conflict: owner.name };
	}

	if (replaced !== undefined) {
		context.targets.delete(bindingKey(replaced));
	}
	if (owner !== undefined) {
		swapBinding(owner, binding, replaced);
		if (replaced !== undefined) {
			context.targets.set(bindingKey(replaced), owner);
		}
	}
	swapBinding(target, replaced, binding);
	context.targets.set(key, target);
	return OK;
}

export function rebindAction(action: ActionState, binding: Binding, options: RebindOptions): RebindResult {
	if (!isBindable(binding)) {
		return INVALID;
	}

	let replaced = options.replace;
	if (replaced !== undefined) {
		if (!action.bindings.includes(replaced)) {
			return INVALID;
		}
	} else {
		const device = deviceOfBinding(binding);
		replaced = action.bindings.find((existing) => deviceOfBinding(existing) === device);
	}
	return assign(action, binding, replaced, options.swap === true);
}

export function rebindDirection(state: DirectionState, binding: Binding, swap: boolean): RebindResult {
	return isBindable(binding) ? assign(state, binding, state.binding, swap) : INVALID;
}

export function resetAction(action: ActionState): RebindResult {
	const targets = action.context.targets;
	for (const binding of action.defaults) {
		const owner = targets.get(bindingKey(binding));
		if (owner !== undefined && owner !== action) {
			return { ok: false, reason: "Conflict", conflict: owner.name };
		}
	}

	for (const binding of action.bindings) {
		targets.delete(bindingKey(binding));
	}
	action.bindings = [...action.defaults];
	for (const binding of action.bindings) {
		targets.set(bindingKey(binding), action);
	}
	return OK;
}

export function resetBindings(
	contexts: ReadonlyMap<string, ContextState>,
	actions: ReadonlyMap<string, ActionState>,
	moveAxes: ReadonlyMap<string, MoveAxisState>,
): void {
	for (const [, context] of contexts) {
		for (const [key, target] of context.targets) {
			if (target.kind !== "analog") {
				context.targets.delete(key);
			}
		}
	}
	for (const [, action] of actions) {
		action.bindings = [...action.defaults];
		for (const binding of action.bindings) {
			action.context.targets.set(bindingKey(binding), action);
		}
	}
	for (const [, axis] of moveAxes) {
		for (const direction of DIRECTIONS) {
			const state = axis.directions[direction];
			state.binding = state.initial;
			axis.context.targets.set(bindingKey(state.binding), state);
		}
	}
}
