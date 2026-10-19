/// <reference types="@rbxts/testez/globals" />

import { createInput, key, mouseMove, stick } from "./fixtures";

export = () => {
	describe("move axes", () => {
		it("builds a vector from the direction keys", () => {
			const input = createInput();
			expect(input.getMove("move")).to.equal(Vector2.zero);

			input.began(key(Enum.KeyCode.W));
			expect(input.getMove("move")).to.equal(new Vector2(0, 1));

			input.began(key(Enum.KeyCode.D));
			const diagonal = input.getMove("move");
			expect(diagonal.Magnitude).to.be.near(1, 1e-6);
			expect(diagonal.X).to.be.near(diagonal.Y, 1e-6);

			input.began(key(Enum.KeyCode.S));
			expect(input.getMove("move")).to.equal(new Vector2(1, 0));
		});

		it("reads the stick through the deadzone", () => {
			const input = createInput();

			input.changed(stick(Enum.KeyCode.Thumbstick1, 0.1, 0.05));
			expect(input.getMove("move")).to.equal(Vector2.zero);

			input.changed(stick(Enum.KeyCode.Thumbstick1, 0, -1));
			expect(input.getMove("move").Y).to.be.near(-1, 1e-6);
		});

		it("uses whichever of keys and stick is pushed further", () => {
			const input = createInput();
			input.changed(stick(Enum.KeyCode.Thumbstick1, 0.5, 0));
			const half = input.getMove("move");
			expect(half.X > 0 && half.X < 1).to.equal(true);

			input.began(key(Enum.KeyCode.A));
			expect(input.getMove("move")).to.equal(new Vector2(-1, 0));
		});

		it("treats a stick the game is using as centred", () => {
			const input = createInput();
			input.changed(stick(Enum.KeyCode.Thumbstick1, 1, 0));
			input.changed(stick(Enum.KeyCode.Thumbstick1, 1, 0), true);
			expect(input.getMove("move")).to.equal(Vector2.zero);

			input.changed(stick(Enum.KeyCode.Thumbstick1, 1, 0));
			input.ended(stick(Enum.KeyCode.Thumbstick1, 0, 0));
			expect(input.getMove("move")).to.equal(Vector2.zero);
		});

		it("goes still when the context is covered", () => {
			const input = createInput();
			input.began(key(Enum.KeyCode.W));
			input.changed(stick(Enum.KeyCode.Thumbstick1, 0, 1));

			const pop = input.push("menu");
			expect(input.getMove("move")).to.equal(Vector2.zero);

			pop();
			// W was cancelled while covered, only the stick is still held
			expect(input.getMove("move").Y).to.be.near(1, 1e-6);
			input.ended(key(Enum.KeyCode.W));
			expect(input.getMove("move").Y).to.be.near(1, 1e-6);
		});

		it("hands the stick to a higher context that reads it", () => {
			const input = createInput();
			input.push("vehicle");
			input.changed(stick(Enum.KeyCode.Thumbstick1, 1, 0));

			expect(input.getMove("move")).to.equal(Vector2.zero);
			expect(input.getMove("steer").X).to.be.near(1, 1e-6);
		});
	});

	describe("look axes", () => {
		it("accumulates mouse movement until consumed, with y pointing up", () => {
			const input = createInput();
			input.changed(mouseMove(10, 4));
			input.changed(mouseMove(5, -2));

			const look = input.consumeLook("look", 1 / 60);
			expect(look.X).to.be.near(0.15, 1e-6);
			expect(look.Y).to.be.near(-0.02, 1e-6);
			expect(input.consumeLook("look", 1 / 60)).to.equal(Vector2.zero);
		});

		it("turns at the stick speed scaled by frame time", () => {
			const input = createInput();
			input.changed(stick(Enum.KeyCode.Thumbstick2, 0, 1));

			expect(input.consumeLook("look", 0.5).Y).to.be.near(1, 1e-6);
			expect(input.consumeLook("look", 0.25).Y).to.be.near(0.5, 1e-6);
		});

		it("ignores mouse movement the game handled or that happens under a menu", () => {
			const input = createInput();
			input.changed(mouseMove(10, 0), true);
			const pop = input.push("menu");
			input.changed(mouseMove(10, 0));
			pop();

			expect(input.consumeLook("look", 1 / 60)).to.equal(Vector2.zero);
		});
	});
};
