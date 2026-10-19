/// <reference types="@rbxts/testez/globals" />

import { bindingKey, deviceOfBinding, deviceOfInputType, parseBinding, virtual } from "../binding";
import { applyDeadzone, digitalVector } from "../deadzone";

export = () => {
	describe("binding keys", () => {
		it("round trips keys, mouse buttons and virtual buttons", () => {
			for (const binding of [
				Enum.KeyCode.E,
				Enum.KeyCode.ButtonX,
				Enum.UserInputType.MouseButton2,
				virtual("Jump"),
			]) {
				expect(parseBinding(bindingKey(binding))).to.equal(binding);
			}
			expect(bindingKey(Enum.KeyCode.E)).to.equal("KeyCode.E");
			expect(bindingKey(Enum.UserInputType.MouseButton1)).to.equal("UserInputType.MouseButton1");
			expect(bindingKey(virtual("Jump"))).to.equal("Virtual.Jump");
		});

		it("reuses one object per virtual button name", () => {
			expect(virtual("Attack")).to.equal(virtual("Attack"));
		});

		it("rejects strings that aren't usable bindings", () => {
			for (const key of [
				"",
				"E",
				"KeyCode.",
				"KeyCode.NotAKey",
				"KeyCode.None",
				"KeyCode.Thumbstick1",
				"UserInputType.Keyboard",
				"UserInputType.MouseMovement",
				"Virtual.",
				"Mouse.Button1",
			]) {
				expect(parseBinding(key)).never.to.be.ok();
			}
		});
	});

	describe("devices", () => {
		it("classifies bindings", () => {
			expect(deviceOfBinding(Enum.KeyCode.E)).to.equal("KeyboardMouse");
			expect(deviceOfBinding(Enum.KeyCode.LeftShift)).to.equal("KeyboardMouse");
			expect(deviceOfBinding(Enum.UserInputType.MouseButton1)).to.equal("KeyboardMouse");
			expect(deviceOfBinding(Enum.KeyCode.ButtonA)).to.equal("Gamepad");
			expect(deviceOfBinding(Enum.KeyCode.DPadUp)).to.equal("Gamepad");
			expect(deviceOfBinding(Enum.KeyCode.ButtonL2)).to.equal("Gamepad");
			expect(deviceOfBinding(virtual("Attack"))).to.equal("Touch");
		});

		it("classifies input types", () => {
			expect(deviceOfInputType(Enum.UserInputType.Keyboard)).to.equal("KeyboardMouse");
			expect(deviceOfInputType(Enum.UserInputType.MouseMovement)).to.equal("KeyboardMouse");
			expect(deviceOfInputType(Enum.UserInputType.Gamepad3)).to.equal("Gamepad");
			expect(deviceOfInputType(Enum.UserInputType.Touch)).to.equal("Touch");
			expect(deviceOfInputType(Enum.UserInputType.Focus)).never.to.be.ok();
		});
	});

	describe("deadzone", () => {
		it("ignores tilt inside the deadzone", () => {
			expect(applyDeadzone(0.1, 0.05, 0.2)).to.equal(Vector2.zero);
		});

		it("rescales so the edge of the deadzone is zero and full tilt is one", () => {
			expect(applyDeadzone(0.21, 0, 0.2).X).to.be.near(0.0125, 1e-6);
			expect(applyDeadzone(0.6, 0, 0.2).X).to.be.near(0.5, 1e-6);
			expect(applyDeadzone(0, -1, 0.2).Y).to.be.near(-1, 1e-6);
		});

		it("keeps the direction and caps the length at one", () => {
			const tilt = applyDeadzone(0.9, 0.9, 0.2);
			expect(tilt.Magnitude).to.be.near(1, 1e-6);
			expect(tilt.X).to.be.near(tilt.Y, 1e-6);
		});

		it("normalises diagonal keys so they aren't faster", () => {
			expect(digitalVector(1, 1).Magnitude).to.be.near(1, 1e-6);
			expect(digitalVector(-1, 0)).to.equal(new Vector2(-1, 0));
			expect(digitalVector(0, 0)).to.equal(Vector2.zero);
		});
	});
};
