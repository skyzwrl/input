/// <reference types="@rbxts/testez/globals" />

import { createClock, createInput, key, pad, recordPhases } from "./fixtures";

export = () => {
	describe("context priority", () => {
		it("gives a key to the highest context that binds it", () => {
			const input = createInput();
			const block = recordPhases(input, "block");
			const honk = recordPhases(input, "honk");
			input.push("vehicle");

			input.began(key(Enum.KeyCode.F));
			input.ended(key(Enum.KeyCode.F));

			expect(honk.join(",")).to.equal("began,ended");
			expect(block.size()).to.equal(0);
		});

		it("lets keys the higher context doesn't bind fall through", () => {
			const input = createInput();
			const dash = recordPhases(input, "dash");
			input.push("vehicle");

			input.began(key(Enum.KeyCode.Q));

			expect(dash.join(",")).to.equal("began");
		});

		it("shares keys with lower contexts when the context doesn't sink", () => {
			const input = createInput();
			const block = recordPhases(input, "block");
			const wave = recordPhases(input, "wave");
			input.push("emotes");

			input.began(key(Enum.KeyCode.F));

			expect(wave.join(",")).to.equal("began");
			expect(block.join(",")).to.equal("began");
		});

		it("blocks every lower context, bound or not, under a context that sinks all", () => {
			const input = createInput();
			const dash = recordPhases(input, "dash");
			const back = recordPhases(input, "back");
			input.push("menu");

			input.began(key(Enum.KeyCode.Q));
			input.began(pad(Enum.KeyCode.ButtonB));

			expect(dash.size()).to.equal(0);
			expect(back.join(",")).to.equal("began");
		});

		it("routes the same physical button to whichever context is on top", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const dash = recordPhases(input, "dash");
			const back = recordPhases(input, "back");

			input.began(pad(Enum.KeyCode.ButtonB));
			input.ended(pad(Enum.KeyCode.ButtonB));
			const pop = input.push("menu");
			input.began(pad(Enum.KeyCode.ButtonB));
			input.ended(pad(Enum.KeyCode.ButtonB));
			pop();
			// past the double tap window so the second dash is just a press
			clock.advance(1);
			input.began(pad(Enum.KeyCode.ButtonB));

			expect(dash.join(",")).to.equal("began,ended,began");
			expect(back.join(",")).to.equal("began,ended");
		});
	});

	describe("push and pop", () => {
		it("keeps a context active until every push is popped", () => {
			const input = createInput();
			const first = input.push("menu");
			const second = input.push("menu");

			first();
			first();
			expect(input.isActive("menu")).to.equal(true);
			second();
			expect(input.isActive("menu")).to.equal(false);
		});

		it("cancels held actions when their context is covered by one that sinks all", () => {
			const input = createInput();
			const block = recordPhases(input, "block");

			input.began(key(Enum.KeyCode.F));
			input.push("menu");
			input.ended(key(Enum.KeyCode.F));

			expect(block.join(",")).to.equal("began,ended:cancelled");
			expect(input.isDown("block")).to.equal(false);
		});

		it("cancels held actions when their context is popped", () => {
			const input = createInput();
			const confirm = recordPhases(input, "confirm");
			const pop = input.push("menu");

			input.began(key(Enum.KeyCode.Return));
			pop();

			expect(confirm.join(",")).to.equal("began,ended:cancelled");
		});

		it("only cancels a held key when a new context takes that key", () => {
			const input = createInput();
			const block = recordPhases(input, "block");
			const dash = recordPhases(input, "dash");

			input.began(key(Enum.KeyCode.F));
			input.began(key(Enum.KeyCode.Q));
			input.push("vehicle");

			expect(block.join(",")).to.equal("began,ended:cancelled");
			expect(dash.join(",")).to.equal("began");
		});

		it("keeps an action held through another binding when only one of its keys is taken", () => {
			const input = createInput();
			const block = recordPhases(input, "block");

			input.began(key(Enum.KeyCode.F));
			input.began(pad(Enum.KeyCode.ButtonL2));
			input.push("vehicle");

			expect(input.isDown("block")).to.equal(true);
			input.ended(pad(Enum.KeyCode.ButtonL2));
			expect(block.join(",")).to.equal("began,ended");
		});

		it("handles a listener that opens a menu from inside a press", () => {
			const input = createInput();
			const openMenu = recordPhases(input, "openMenu");
			input.on("openMenu", "began", () => input.push("menu"));

			input.began(key(Enum.KeyCode.M));
			input.ended(key(Enum.KeyCode.M));

			expect(input.isActive("menu")).to.equal(true);
			expect(openMenu.join(",")).to.equal("began,ended:cancelled");
		});
	});
};
