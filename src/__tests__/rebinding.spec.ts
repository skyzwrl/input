/// <reference types="@rbxts/testez/globals" />

import { Binding, bindingKey, virtual } from "../binding";
import { InputMap } from "../input-map";
import { createInput, key, pad, recordPhases } from "./fixtures";

function keysOf(bindings: Binding[]): string {
	return bindings.map((binding) => bindingKey(binding)).join(",");
}

export = () => {
	describe("rebinding actions", () => {
		it("replaces the binding for the same device and keeps the others", () => {
			const input = createInput();

			expect(input.rebind("dash", Enum.KeyCode.E).ok).to.equal(true);
			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.E,KeyCode.ButtonB");

			expect(input.rebind("dash", Enum.KeyCode.ButtonX).ok).to.equal(true);
			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.E,KeyCode.ButtonX");
		});

		it("moves input over to the new binding", () => {
			const input = createInput();
			const dash = recordPhases(input, "dash");
			input.rebind("dash", Enum.KeyCode.E);

			input.began(key(Enum.KeyCode.Q));
			input.began(key(Enum.KeyCode.E));

			expect(dash.join(",")).to.equal("began");
		});

		it("adds a binding when the action has none for that device", () => {
			const input = createInput();
			input.rebind("block", virtual("Block"));
			expect(keysOf(input.getBindings("block"))).to.equal("KeyCode.F,KeyCode.ButtonL2,Virtual.Block");
		});

		it("replaces a specific binding when asked", () => {
			const input = createInput();
			const result = input.rebind("attack", Enum.KeyCode.ButtonR1, { replace: Enum.KeyCode.ButtonR2 });
			expect(result.ok).to.equal(true);
			expect(keysOf(input.getBindings("attack"))).to.equal(
				"UserInputType.MouseButton1,KeyCode.ButtonR1,Virtual.Attack",
			);

			const missing = input.rebind("attack", Enum.KeyCode.ButtonA, { replace: Enum.KeyCode.ButtonY });
			expect(missing.ok).to.equal(false);
		});

		it("reports the action already using a binding", () => {
			const input = createInput();
			const result = input.rebind("dash", Enum.KeyCode.F);

			expect(result.ok).to.equal(false);
			if (!result.ok && result.reason === "Conflict") {
				expect(result.conflict).to.equal("block");
			} else {
				error("expected a conflict");
			}
			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.Q,KeyCode.ButtonB");
		});

		it("swaps bindings between actions when asked", () => {
			const input = createInput();
			expect(input.rebind("dash", Enum.KeyCode.F, { swap: true }).ok).to.equal(true);

			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.F,KeyCode.ButtonB");
			expect(keysOf(input.getBindings("block"))).to.equal("KeyCode.Q,KeyCode.ButtonL2");
		});

		it("takes the binding away when there's nothing to swap back", () => {
			const input = createInput();
			expect(input.rebind("openMenu", virtual("Attack"), { swap: true }).ok).to.equal(true);

			expect(keysOf(input.getBindings("attack"))).to.equal("UserInputType.MouseButton1,KeyCode.ButtonR2");
			expect(keysOf(input.getBindings("openMenu"))).to.equal("KeyCode.M,KeyCode.ButtonStart,Virtual.Attack");
		});

		it("never leaves a movement direction unbound", () => {
			const input = createInput();
			expect(input.rebind("openMenu", virtual("Menu")).ok).to.equal(true);

			expect(input.rebind("openMenu", Enum.KeyCode.W, { replace: virtual("Menu"), swap: true }).ok).to.equal(
				true,
			);
			expect(bindingKey(input.getMoveBinding("move", "up"))).to.equal("Virtual.Menu");

			const result = input.rebind("dash", Enum.KeyCode.A, { replace: Enum.KeyCode.Q, swap: true });
			expect(result.ok).to.equal(true);
			expect(input.getMoveBinding("move", "left")).to.equal(Enum.KeyCode.Q);

			const padOnly = new InputMap({
				contexts: {
					gameplay: {
						priority: 0,
						actions: { use: [Enum.KeyCode.ButtonX] },
						axes: {
							move: {
								type: "move",
								up: Enum.KeyCode.W,
								down: Enum.KeyCode.S,
								left: Enum.KeyCode.A,
								right: Enum.KeyCode.D,
							},
						},
					},
				},
			});
			expect(padOnly.rebind("use", Enum.KeyCode.W, { swap: true }).ok).to.equal(false);
			expect(padOnly.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.W);
		});

		it("refuses bindings that can't be pressed", () => {
			const input = createInput();
			expect(input.rebind("dash", Enum.KeyCode.None).ok).to.equal(false);
			expect(input.rebind("dash", Enum.KeyCode.Thumbstick1).ok).to.equal(false);
			expect(input.rebind("dash", Enum.UserInputType.MouseMovement).ok).to.equal(false);
		});

		it("doesn't treat bindings in other contexts as conflicts", () => {
			const input = createInput();
			expect(input.rebind("back", Enum.KeyCode.Q).ok).to.equal(true);
		});
	});

	describe("rebinding movement", () => {
		it("rebinds a direction", () => {
			const input = createInput();
			expect(input.rebindMove("move", "up", Enum.KeyCode.I).ok).to.equal(true);

			input.began(key(Enum.KeyCode.W));
			expect(input.getMove("move")).to.equal(Vector2.zero);
			input.began(key(Enum.KeyCode.I));
			expect(input.getMove("move")).to.equal(new Vector2(0, 1));
		});

		it("swaps two directions", () => {
			const input = createInput();
			expect(input.rebindMove("move", "up", Enum.KeyCode.S).ok).to.equal(false);
			expect(input.rebindMove("move", "up", Enum.KeyCode.S, true).ok).to.equal(true);

			expect(input.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.S);
			expect(input.getMoveBinding("move", "down")).to.equal(Enum.KeyCode.W);
		});
	});

	describe("resetting", () => {
		it("puts an action back to its defaults", () => {
			const input = createInput();
			input.rebind("dash", Enum.KeyCode.E);
			expect(input.resetAction("dash").ok).to.equal(true);
			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.Q,KeyCode.ButtonB");
		});

		it("won't reset onto a binding another action took", () => {
			const input = createInput();
			input.rebind("dash", Enum.KeyCode.E);
			input.rebind("block", Enum.KeyCode.Q);

			const result = input.resetAction("dash");
			expect(result.ok).to.equal(false);
			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.E,KeyCode.ButtonB");
		});

		it("resets everything at once", () => {
			const input = createInput();
			input.rebind("dash", Enum.KeyCode.F, { swap: true });
			input.rebindMove("move", "up", Enum.KeyCode.I);
			input.resetAll();

			expect(keysOf(input.getBindings("dash"))).to.equal("KeyCode.Q,KeyCode.ButtonB");
			expect(keysOf(input.getBindings("block"))).to.equal("KeyCode.F,KeyCode.ButtonL2");
			expect(input.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.W);

			const block = recordPhases(input, "block");
			input.began(key(Enum.KeyCode.F));
			input.began(key(Enum.KeyCode.I));
			expect(block.join(",")).to.equal("began");
			expect(input.getMove("move")).to.equal(Vector2.zero);
		});
	});

	describe("prompts", () => {
		it("finds the binding to show for each device", () => {
			const input = createInput();
			expect(input.getBindingFor("dash", "KeyboardMouse")).to.equal(Enum.KeyCode.Q);
			expect(input.getBindingFor("dash", "Gamepad")).to.equal(Enum.KeyCode.ButtonB);
			expect(input.getBindingFor("dash", "Touch")).never.to.be.ok();
			expect(input.getBindingFor("attack")).to.equal(Enum.UserInputType.MouseButton1);

			input.began(pad(Enum.KeyCode.ButtonY));
			expect(input.getBindingFor("attack")).to.equal(Enum.KeyCode.ButtonR2);
		});
	});
};
