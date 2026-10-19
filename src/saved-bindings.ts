import { Binding, bindingKey, parseBinding } from "./binding";
import { ActionState, DIRECTIONS, DirectionState, MoveAxisState } from "./state";
import { Direction } from "./types";

export const SAVE_VERSION = 1;

export interface SavedBindings {
	readonly version: number;
	readonly actions: { readonly [action: string]: readonly string[] };
	readonly moves: { readonly [axis: string]: { readonly [direction: string]: string } };
}

function entries(value: object): Map<unknown, unknown> {
	return value as Map<unknown, unknown>;
}

function sortedKeys(record: object): string[] {
	const keys: string[] = [];
	for (const [key] of record as Map<string, unknown>) {
		keys.push(key);
	}
	keys.sort();
	return keys;
}

function sameBindings(a: readonly Binding[], b: readonly Binding[]): boolean {
	if (a.size() !== b.size()) {
		return false;
	}
	for (let index = 0; index < a.size(); index++) {
		if (a[index] !== b[index]) {
			return false;
		}
	}
	return true;
}

function readList(name: string, value: unknown, problems: string[]): string[] | undefined {
	if (!typeIs(value, "table")) {
		problems.push(`bindings for ${name} are not a list`);
		return undefined;
	}

	const indexed: [number, string][] = [];
	for (const [index, key] of entries(value)) {
		if (!typeIs(index, "number") || !typeIs(key, "string")) {
			problems.push(`bindings for ${name} contain a value that isn't a binding`);
			return undefined;
		}
		indexed.push([index, key]);
	}
	indexed.sort((a, b) => a[0] < b[0]);
	return indexed.map((entry) => entry[1]);
}

// only checks the shape; whether the actions and bindings exist is decided while loading
function readSavedBindings(data: unknown, problems: string[]): SavedBindings | undefined {
	if (!typeIs(data, "table")) {
		problems.push("saved bindings are not a table");
		return undefined;
	}

	const record = data as { version?: unknown; actions?: unknown; moves?: unknown };
	if (record.version !== SAVE_VERSION) {
		problems.push(`saved bindings have unsupported version ${tostring(record.version)}`);
		return undefined;
	}

	const actions: Record<string, string[]> = {};
	if (typeIs(record.actions, "table")) {
		for (const [name, value] of entries(record.actions)) {
			if (!typeIs(name, "string")) {
				problems.push("saved bindings contain an action without a name");
				continue;
			}
			const list = readList(name, value, problems);
			if (list !== undefined) {
				actions[name] = list;
			}
		}
	}

	const moves: Record<string, Record<string, string>> = {};
	if (typeIs(record.moves, "table")) {
		for (const [name, value] of entries(record.moves)) {
			if (!typeIs(name, "string") || !typeIs(value, "table")) {
				problems.push(`saved bindings for move axis ${tostring(name)} are not a table`);
				continue;
			}
			const directions: Record<string, string> = {};
			for (const [direction, key] of entries(value)) {
				if (typeIs(direction, "string") && typeIs(key, "string")) {
					directions[direction] = key;
				} else {
					problems.push(`saved bindings for move axis ${name} contain a value that isn't a binding`);
				}
			}
			moves[name] = directions;
		}
	}

	return { version: SAVE_VERSION, actions, moves };
}

function isDirectionOf(axis: MoveAxisState, state: DirectionState): boolean {
	const { up, down, left, right } = axis.directions;
	return state === up || state === down || state === left || state === right;
}

// all four directions load together or not at all, so movement can't end up with a key missing
function loadMoveAxis(axis: MoveAxisState, saved: { readonly [direction: string]: string }, problems: string[]): void {
	for (const key of sortedKeys(saved)) {
		if (!DIRECTIONS.includes(key as Direction)) {
			problems.push(`${axis.name}: unknown direction ${key}`);
		}
	}

	const targets = axis.context.targets;
	const wanted = new Map<Direction, Binding>();
	const taken = new Map<string, DirectionState>();
	let clean = true;
	for (const direction of DIRECTIONS) {
		const state = axis.directions[direction];
		const key = saved[direction];
		let binding = state.binding;
		if (key !== undefined) {
			const parsed = parseBinding(key);
			if (parsed === undefined) {
				problems.push(`${state.name}: ${key} is not a usable binding`);
			} else {
				binding = parsed;
			}
		}

		// directions of this axis are about to be reassigned, so only a repeat among them or anything
		// else in the context counts as a clash
		const name = bindingKey(binding);
		const owner = targets.get(name);
		const clash =
			taken.get(name) ??
			(owner !== undefined && !(owner.kind === "direction" && isDirectionOf(axis, owner)) ? owner : undefined);
		if (clash !== undefined) {
			problems.push(`${state.name}: ${name} is already used by ${clash.name}`);
			clean = false;
		}
		taken.set(name, state);
		wanted.set(direction, binding);
	}
	if (!clean) {
		return;
	}

	for (const direction of DIRECTIONS) {
		targets.delete(bindingKey(axis.directions[direction].binding));
	}
	for (const direction of DIRECTIONS) {
		const state = axis.directions[direction];
		state.binding = wanted.get(direction)!;
		targets.set(bindingKey(state.binding), state);
	}
}

function loadAction(action: ActionState, keys: readonly string[], problems: string[]): void {
	const targets = action.context.targets;
	for (const key of keys) {
		const binding = parseBinding(key);
		if (binding === undefined) {
			problems.push(`${action.name}: ${key} is not a usable binding`);
			continue;
		}
		const name = bindingKey(binding);
		const owner = targets.get(name);
		if (owner === undefined) {
			action.bindings.push(binding);
			targets.set(name, action);
		} else if (owner !== action) {
			problems.push(`${action.name}: ${name} is already used by ${owner.name}`);
		}
	}

	if (action.bindings.isEmpty()) {
		for (const binding of action.defaults) {
			const name = bindingKey(binding);
			if (targets.get(name) === undefined) {
				action.bindings.push(binding);
				targets.set(name, action);
			}
		}
	}
}

// only what differs from the defaults, so changing a default later still reaches players with old saves
export function saveBindings(
	actions: ReadonlyMap<string, ActionState>,
	moveAxes: ReadonlyMap<string, MoveAxisState>,
): SavedBindings {
	const savedActions: Record<string, string[]> = {};
	for (const [name, action] of actions) {
		if (!sameBindings(action.bindings, action.defaults)) {
			savedActions[name] = action.bindings.map((binding) => bindingKey(binding));
		}
	}

	const moves: Record<string, Record<string, string>> = {};
	for (const [name, axis] of moveAxes) {
		let changed: Record<string, string> | undefined;
		for (const direction of DIRECTIONS) {
			const state = axis.directions[direction];
			if (state.binding !== state.initial) {
				changed ??= {};
				changed[direction] = bindingKey(state.binding);
			}
		}
		if (changed !== undefined) {
			moves[name] = changed;
		}
	}

	return { version: SAVE_VERSION, actions: savedActions, moves };
}

// expects every binding at its default. returns what couldn't be applied; anything skipped keeps its default
export function loadBindings(
	data: unknown,
	actions: ReadonlyMap<string, ActionState>,
	moveAxes: ReadonlyMap<string, MoveAxisState>,
): string[] {
	const problems: string[] = [];
	const saved = readSavedBindings(data, problems);
	if (saved === undefined) {
		return problems;
	}

	// saved actions let go of their defaults first so swaps between them (or with movement) can load
	const loading = new Array<ActionState>();
	for (const name of sortedKeys(saved.actions)) {
		const action = actions.get(name);
		if (action === undefined) {
			problems.push(`unknown action ${name}`);
			continue;
		}
		loading.push(action);
		for (const binding of action.bindings) {
			action.context.targets.delete(bindingKey(binding));
		}
		action.bindings = [];
	}

	for (const name of sortedKeys(saved.moves)) {
		const axis = moveAxes.get(name);
		if (axis === undefined) {
			problems.push(`unknown move axis ${name}`);
		} else {
			loadMoveAxis(axis, saved.moves[name], problems);
		}
	}

	for (const action of loading) {
		loadAction(action, saved.actions[action.name], problems);
	}
	return problems;
}
