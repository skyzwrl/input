/// <reference types="@rbxts/testez/globals" />

import { ActionEvent, InputMap } from "../input-map";
import { click, createClock, createInput, key, pad, recordPhases } from "./fixtures";

export = () => {
	describe("pressing actions", () => {
		it("fires began and ended with the binding, device and time", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const events: ActionEvent[] = [];
			input.on("attack", "began", (event) => events.push(event));
			input.on("attack", "ended", (event) => events.push(event));

			clock.advance(2);
			input.began(click(Enum.UserInputType.MouseButton1));
			clock.advance(0.25);
			input.ended(click(Enum.UserInputType.MouseButton1));

			expect(events.size()).to.equal(2);
			expect(events[0].phase).to.equal("began");
			expect(events[0].action).to.equal("attack");
			expect(events[0].binding).to.equal(Enum.UserInputType.MouseButton1);
			expect(events[0].device).to.equal("KeyboardMouse");
			expect(events[0].time).to.equal(2);
			expect(events[1].phase).to.equal("ended");
			expect(events[1].heldFor).to.be.near(0.25, 1e-9);
			expect(events[1].cancelled).to.equal(false);
		});

		it("stays down until every binding holding it is released", () => {
			const input = createInput();
			const phases = recordPhases(input, "block");

			input.began(key(Enum.KeyCode.F));
			input.began(pad(Enum.KeyCode.ButtonL2));
			input.ended(key(Enum.KeyCode.F));
			expect(input.isDown("block")).to.equal(true);
			input.ended(pad(Enum.KeyCode.ButtonL2));

			expect(input.isDown("block")).to.equal(false);
			expect(phases.join(",")).to.equal("began,ended");
		});

		it("ignores presses the game already handled but still takes their release", () => {
			const input = createInput();
			const phases = recordPhases(input, "dash");

			input.began(key(Enum.KeyCode.Q), true);
			input.ended(key(Enum.KeyCode.Q));
			expect(phases.size()).to.equal(0);

			input.began(key(Enum.KeyCode.Q));
			input.ended(key(Enum.KeyCode.Q));
			expect(phases.join(",")).to.equal("began,ended");
		});

		it("ignores a repeated press of a key that is already down", () => {
			const input = createInput();
			const phases = recordPhases(input, "openMenu");

			input.began(key(Enum.KeyCode.M));
			input.began(key(Enum.KeyCode.M));
			input.ended(key(Enum.KeyCode.M));

			expect(phases.join(",")).to.equal("began,ended");
		});

		it("drives actions from virtual buttons", () => {
			const input = createInput();
			let device = "";
			input.on("attack", "began", (event) => {
				device = event.device;
			});

			input.pressVirtual("Attack");
			expect(input.isDown("attack")).to.equal(true);
			expect(device).to.equal("Touch");
			input.releaseVirtual("Attack");
			expect(input.isDown("attack")).to.equal(false);
		});

		it("stops calling a listener once it's disconnected", () => {
			const input = createInput();
			let calls = 0;
			const disconnect = input.on("attack", "began", () => calls++);

			input.began(click(Enum.UserInputType.MouseButton1));
			input.ended(click(Enum.UserInputType.MouseButton1));
			disconnect();
			input.began(click(Enum.UserInputType.MouseButton1));

			expect(calls).to.equal(1);
		});

		it("cancels everything held when releaseAll runs", () => {
			const input = createInput();
			const phases = recordPhases(input, "block");

			input.began(key(Enum.KeyCode.F));
			input.began(key(Enum.KeyCode.W));
			input.releaseAll();

			expect(phases.join(",")).to.equal("began,ended:cancelled");
			expect(input.getMove("move")).to.equal(Vector2.zero);
			// the real key up after focus comes back finds nothing to release
			input.ended(key(Enum.KeyCode.F));
			expect(phases.size()).to.equal(2);
		});
	});

	describe("configuration", () => {
		it("rejects the same binding twice in one context", () => {
			expect(() => {
				new InputMap({
					contexts: { gameplay: { priority: 0, actions: { a: [Enum.KeyCode.E], b: [Enum.KeyCode.E] } } },
				});
			}).to.throw("KeyCode.E is used by both");
		});

		it("rejects an action defined in two contexts", () => {
			expect(() => {
				new InputMap({
					contexts: {
						one: { priority: 0, actions: { use: [Enum.KeyCode.E] } },
						two: { priority: 1, actions: { use: [Enum.KeyCode.F] } },
					},
				});
			}).to.throw("action use is defined in more than one context");
		});

		it("rejects unusable bindings and settings", () => {
			expect(() => {
				new InputMap({ contexts: { gameplay: { priority: 0, actions: { a: [Enum.KeyCode.None] } } } });
			}).to.throw("can't be bound");
			expect(() => {
				new InputMap({
					contexts: { gameplay: { priority: 0, actions: { a: { bindings: [Enum.KeyCode.E], hold: 0 } } } },
				});
			}).to.throw("positive hold time");
			expect(() => {
				new InputMap({
					contexts: {
						gameplay: {
							priority: 0,
							axes: { look: { type: "look", stick: Enum.KeyCode.ButtonA } },
						},
					},
				});
			}).to.throw("Thumbstick1 or Thumbstick2");
			expect(() => {
				new InputMap({ contexts: { gameplay: { priority: 0 } }, active: ["missing"] });
			}).to.throw("unknown context missing");
		});

		it("errors on names it doesn't know", () => {
			const input = createInput();
			expect(() => input.isDown("nope" as never)).to.throw("unknown action nope");
			expect(() => input.push("nope" as never)).to.throw("unknown context nope");
		});
	});
};
