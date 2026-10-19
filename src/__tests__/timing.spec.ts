/// <reference types="@rbxts/testez/globals" />

import { createClock, createInput, key, pad, recordPhases } from "./fixtures";

export = () => {
	describe("holding", () => {
		it("fires held once the threshold passes, then ended on release", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const phases = recordPhases(input, "heavy");

			input.began(key(Enum.KeyCode.R));
			clock.advance(0.3);
			input.update();
			expect(phases.join(",")).to.equal("began");

			clock.advance(0.25);
			input.update();
			input.update();
			expect(phases.join(",")).to.equal("began,held");

			input.ended(key(Enum.KeyCode.R));
			expect(phases.join(",")).to.equal("began,held,ended");
		});

		it("reports a short press as a tap before it ends", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const phases = recordPhases(input, "heavy");

			input.began(pad(Enum.KeyCode.ButtonY));
			clock.advance(0.2);
			input.update();
			input.ended(pad(Enum.KeyCode.ButtonY));

			expect(phases.join(",")).to.equal("began,tapped,ended");
		});

		it("still fires held before ended when no update ran past the threshold", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const phases = recordPhases(input, "heavy");

			input.began(key(Enum.KeyCode.R));
			clock.advance(0.8);
			input.ended(key(Enum.KeyCode.R));

			expect(phases.join(",")).to.equal("began,held,ended");
		});

		it("reports hold progress for charge bars", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });

			expect(input.holdProgress("heavy")).to.equal(0);
			input.began(key(Enum.KeyCode.R));
			clock.advance(0.125);
			expect(input.holdProgress("heavy")).to.be.near(0.25, 1e-9);
			clock.advance(5);
			expect(input.holdProgress("heavy")).to.equal(1);
			input.ended(key(Enum.KeyCode.R));
			expect(input.holdProgress("heavy")).to.equal(0);
			expect(input.holdProgress("attack")).to.equal(0);
		});

		it("doesn't report a tap or hold for a cancelled press", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const phases = recordPhases(input, "heavy");

			input.began(key(Enum.KeyCode.R));
			clock.advance(0.1);
			input.push("menu");
			clock.advance(1);
			input.update();

			expect(phases.join(",")).to.equal("began,ended:cancelled");
		});
	});

	describe("double taps", () => {
		it("fires when the second press lands inside the window", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			const phases = recordPhases(input, "dash");

			input.began(key(Enum.KeyCode.Q));
			clock.advance(0.1);
			input.ended(key(Enum.KeyCode.Q));
			clock.advance(0.1);
			input.began(key(Enum.KeyCode.Q));

			expect(phases.join(",")).to.equal("began,ended,began,doubleTapped");
		});

		it("doesn't fire when the presses are too far apart", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			let doubles = 0;
			input.on("dash", "doubleTapped", () => doubles++);

			input.began(key(Enum.KeyCode.Q));
			input.ended(key(Enum.KeyCode.Q));
			clock.advance(0.31);
			input.began(key(Enum.KeyCode.Q));

			expect(doubles).to.equal(0);
		});

		it("needs a fresh pair after a double tap", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			let doubles = 0;
			input.on("dash", "doubleTapped", () => doubles++);

			for (let press = 0; press < 4; press++) {
				input.began(pad(Enum.KeyCode.ButtonB));
				input.ended(pad(Enum.KeyCode.ButtonB));
				clock.advance(0.1);
			}

			expect(doubles).to.equal(2);
		});

		it("counts presses across different bindings of the same action", () => {
			const clock = createClock();
			const input = createInput({ clock: clock.read });
			let doubles = 0;
			input.on("dash", "doubleTapped", () => doubles++);

			input.began(key(Enum.KeyCode.Q));
			input.ended(key(Enum.KeyCode.Q));
			clock.advance(0.2);
			input.began(pad(Enum.KeyCode.ButtonB));

			expect(doubles).to.equal(1);
		});
	});
};
