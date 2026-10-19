import { Binding, Device, bindingKey, isBindable } from "./binding";
import { SinkMode } from "./config";
import { ContextState, Target } from "./state";

export function claimKey(context: ContextState, key: string, target: Target): void {
	const existing = context.targets.get(key);
	if (existing !== undefined) {
		throw `${key} is used by both ${existing.name} and ${target.name} in context ${context.name}`;
	}
	context.targets.set(key, target);
}

export function claim(context: ContextState, binding: Binding, target: Target): void {
	if (!isBindable(binding)) {
		throw `${target.name} can't be bound to ${bindingKey(binding)}`;
	}
	claimKey(context, bindingKey(binding), target);
}

// orders the active contexts and decides which targets a key reaches. a key that's down belongs to the
// targets that took its press until it's released or they stop seeing it
export class ContextStack {
	private readonly contexts = new Map<string, ContextState>();
	private readonly owners = new Map<string, Target[]>();
	private stack = new Array<ContextState>();
	private refreshing = false;
	private refreshQueued = false;

	public constructor(
		private readonly clock: () => number,
		private readonly onPress: (target: Target, binding: Binding, device: Device, now: number) => void,
		private readonly onRelease: (target: Target, now: number, cancelled: boolean) => void,
	) {}

	public add(name: string, priority: number, sink: SinkMode): ContextState {
		if (!(priority > -math.huge && priority < math.huge)) {
			throw `context ${name} needs a finite priority`;
		}
		const context: ContextState = { name, priority, sink, targets: new Map(), pushes: 0 };
		this.contexts.set(name, context);
		return context;
	}

	public all(): ReadonlyMap<string, ContextState> {
		return this.contexts;
	}

	public named(name: string): ContextState {
		const context = this.contexts.get(name);
		if (context === undefined) {
			throw `unknown context ${name}`;
		}
		return context;
	}

	public activate(names: readonly string[]): void {
		for (const name of names) {
			this.named(name).pushes += 1;
		}
		this.changed();
	}

	public push(name: string): () => void {
		const context = this.named(name);
		context.pushes += 1;
		this.changed();

		let popped = false;
		return () => {
			if (popped) {
				return;
			}
			popped = true;
			context.pushes -= 1;
			this.changed();
		};
	}

	public isActive(name: string): boolean {
		return this.named(name).pushes > 0;
	}

	public press(key: string, binding: Binding, device: Device): void {
		if (this.owners.has(key)) {
			return;
		}
		const receivers = this.route(key);
		if (receivers === undefined) {
			return;
		}

		this.owners.set(key, receivers);
		const now = this.clock();
		for (const target of receivers) {
			this.onPress(target, binding, device, now);
		}
	}

	public release(key: string): void {
		const receivers = this.owners.get(key);
		if (receivers === undefined) {
			return;
		}
		this.owners.delete(key);

		const now = this.clock();
		for (const target of receivers) {
			this.onRelease(target, now, false);
		}
	}

	public releaseAll(): void {
		const lost = new Array<Target>();
		for (const [, receivers] of this.owners) {
			for (const target of receivers) {
				lost.push(target);
			}
		}
		this.owners.clear();

		const now = this.clock();
		for (const target of lost) {
			this.onRelease(target, now, true);
		}
	}

	// same walk as route without building a list, for inputs read every frame
	public receives(target: Target, key: string): boolean {
		for (const context of this.stack) {
			const found = context.targets.get(key);
			if (found === target) {
				return true;
			} else if ((found !== undefined && context.sink !== "none") || context.sink === "all") {
				return false;
			}
		}
		return false;
	}

	private route(key: string): Target[] | undefined {
		let receivers: Target[] | undefined;
		for (const context of this.stack) {
			const target = context.targets.get(key);
			if (target !== undefined) {
				receivers ??= [];
				receivers.push(target);
				if (context.sink !== "none") {
					break;
				}
			} else if (context.sink === "all") {
				break;
			}
		}
		return receivers;
	}

	private changed(): void {
		const stack = new Array<ContextState>();
		for (const [, context] of this.contexts) {
			if (context.pushes > 0) {
				stack.push(context);
			}
		}
		stack.sort((a, b) => (a.priority !== b.priority ? a.priority > b.priority : a.name < b.name));
		this.stack = stack;
		this.refreshOwnership();
	}

	// a held input whose context can't see it anymore would never get its release, so it's cancelled here.
	// listeners of the cancelled actions may push or pop again, which queues another pass
	private refreshOwnership(): void {
		if (this.refreshing) {
			this.refreshQueued = true;
			return;
		}

		this.refreshing = true;
		do {
			this.refreshQueued = false;
			const lost = new Array<Target>();
			for (const [key, receivers] of this.owners) {
				for (let index = receivers.size() - 1; index >= 0; index--) {
					if (!this.receives(receivers[index], key)) {
						lost.push(receivers[index]);
						receivers.remove(index);
					}
				}
				if (receivers.isEmpty()) {
					this.owners.delete(key);
				}
			}

			const now = this.clock();
			for (const target of lost) {
				this.onRelease(target, now, true);
			}
		} while (this.refreshQueued);
		this.refreshing = false;
	}
}
