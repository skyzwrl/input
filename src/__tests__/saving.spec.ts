/// <reference types="@rbxts/testez/globals" />

import { bindingKey } from "../binding";
import { createInput, key, recordPhases } from "./fixtures";

export = () => {
	describe("saving", () => {
		it("only saves what differs from the defaults", () => {
			const input = createInput();
			const untouched = input.saveBindings();
			expect(next(untouched.actions)[0]).never.to.be.ok();
			expect(next(untouched.moves)[0]).never.to.be.ok();

			input.rebind("dash", Enum.KeyCode.E);
			input.rebindMove("move", "up", Enum.KeyCode.I);
			const saved = input.saveBindings();

			expect(saved.version).to.equal(1);
			expect(saved.actions.dash.join(",")).to.equal("KeyCode.E,KeyCode.ButtonB");
			expect(saved.actions.block).never.to.be.ok();
			expect(saved.moves.move.up).to.equal("KeyCode.I");
			expect(saved.moves.move.down).never.to.be.ok();
		});

		it("round trips into a fresh map", () => {
			const before = createInput();
			before.rebind("dash", Enum.KeyCode.F, { swap: true });
			before.rebindMove("move", "left", Enum.KeyCode.J);

			const after = createInput();
			const problems = after.loadBindings(before.saveBindings());

			expect(problems.size()).to.equal(0);
			expect(bindingKey(after.getBindings("dash")[0])).to.equal("KeyCode.F");
			expect(bindingKey(after.getBindings("block")[0])).to.equal("KeyCode.Q");
			expect(after.getMoveBinding("move", "left")).to.equal(Enum.KeyCode.J);

			const dash = recordPhases(after, "dash");
			after.began(key(Enum.KeyCode.F));
			expect(dash.join(",")).to.equal("began");
		});

		it("loads swaps between actions and movement", () => {
			const before = createInput();
			before.rebind("dash", Enum.KeyCode.W, { swap: true });

			const after = createInput();
			expect(after.loadBindings(before.saveBindings()).size()).to.equal(0);
			expect(after.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.Q);
			expect(after.getBindings("dash")[0]).to.equal(Enum.KeyCode.W);
		});

		it("starts from the defaults when loading", () => {
			const input = createInput();
			input.rebind("block", Enum.KeyCode.G);
			input.loadBindings({ version: 1, actions: {}, moves: {} });
			expect(bindingKey(input.getBindings("block")[0])).to.equal("KeyCode.F");
		});
	});

	describe("loading bad data", () => {
		it("rejects data that isn't a save", () => {
			const input = createInput();
			expect(input.loadBindings("nope").size()).to.equal(1);
			expect(input.loadBindings({ version: 99, actions: {} })[0]).to.equal(
				"saved bindings have unsupported version 99",
			);
		});

		it("skips what it can't use and reports each problem", () => {
			const input = createInput();
			const problems = input.loadBindings({
				version: 1,
				actions: {
					dash: ["KeyCode.E", "KeyCode.NotAKey", "KeyCode.ButtonX"],
					fly: ["KeyCode.Space"],
					block: "KeyCode.F",
				},
				moves: { move: { up: "KeyCode.I", sideways: "KeyCode.K" }, wings: { up: "KeyCode.U" } },
			});

			expect(problems.size()).to.equal(5);
			expect(problems.join("\n").find("unknown action fly")[0]).to.be.ok();
			expect(problems.join("\n").find("KeyCode.NotAKey is not a usable binding")[0]).to.be.ok();
			expect(problems.join("\n").find("bindings for block are not a list")[0]).to.be.ok();
			expect(problems.join("\n").find("unknown direction sideways")[0]).to.be.ok();
			expect(problems.join("\n").find("unknown move axis wings")[0]).to.be.ok();

			expect(
				input
					.getBindings("dash")
					.map((binding) => bindingKey(binding))
					.join(","),
			).to.equal("KeyCode.E,KeyCode.ButtonX");
			expect(input.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.I);
		});

		it("drops saved bindings that now clash with another action", () => {
			const input = createInput();
			const problems = input.loadBindings({ version: 1, actions: { dash: ["KeyCode.F", "KeyCode.ButtonB"] } });

			expect(problems.size()).to.equal(1);
			expect(problems[0]).to.equal("dash: KeyCode.F is already used by block");
			expect(
				input
					.getBindings("dash")
					.map((binding) => bindingKey(binding))
					.join(","),
			).to.equal("KeyCode.ButtonB");
		});

		it("keeps the defaults when every saved binding is unusable", () => {
			const input = createInput();
			const problems = input.loadBindings({ version: 1, actions: { dash: ["KeyCode.F"] } });

			expect(problems.size()).to.equal(1);
			expect(
				input
					.getBindings("dash")
					.map((binding) => bindingKey(binding))
					.join(","),
			).to.equal("KeyCode.Q,KeyCode.ButtonB");
		});

		it("keeps the whole move axis on its defaults when the saved keys repeat", () => {
			const input = createInput();
			const problems = input.loadBindings({ version: 1, moves: { move: { up: "KeyCode.S" } } });

			expect(problems.size()).to.equal(1);
			expect(problems[0]).to.equal("move.down: KeyCode.S is already used by move.up");
			expect(input.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.W);
			expect(input.getMoveBinding("move", "down")).to.equal(Enum.KeyCode.S);
		});

		it("drops a saved movement key that clashes", () => {
			const input = createInput();
			const problems = input.loadBindings({ version: 1, moves: { move: { up: "KeyCode.Q" } } });

			expect(problems[0]).to.equal("move.up: KeyCode.Q is already used by dash");
			expect(input.getMoveBinding("move", "up")).to.equal(Enum.KeyCode.W);
		});
	});
};
