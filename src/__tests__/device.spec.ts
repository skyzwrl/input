/// <reference types="@rbxts/testez/globals" />

import { Device } from "../binding";
import { click, createInput, key, mouseMove, pad, screenTouch, stick } from "./fixtures";

export = () => {
	describe("device detection", () => {
		it("follows the last device used", () => {
			const input = createInput();
			const changes: Device[] = [];
			input.onDeviceChanged((device) => changes.push(device));

			input.began(pad(Enum.KeyCode.ButtonA));
			input.began(key(Enum.KeyCode.W));
			input.began(key(Enum.KeyCode.A));
			input.began(screenTouch());
			input.changed(mouseMove(3, 0));
			input.began(click(Enum.UserInputType.MouseButton2));

			expect(changes.join(",")).to.equal("Gamepad,KeyboardMouse,Touch,KeyboardMouse");
			expect(input.getDevice()).to.equal("KeyboardMouse");
		});

		it("doesn't switch to gamepad on stick drift", () => {
			const input = createInput();
			input.changed(stick(Enum.KeyCode.Thumbstick1, 0.1, 0.05));
			expect(input.getDevice()).to.equal("KeyboardMouse");

			input.changed(stick(Enum.KeyCode.Thumbstick1, 0.6, 0));
			expect(input.getDevice()).to.equal("Gamepad");
		});

		it("starts on the device it's given and switches to touch for virtual buttons", () => {
			const input = createInput({ device: "Gamepad" });
			expect(input.getDevice()).to.equal("Gamepad");

			input.pressVirtual("Attack");
			expect(input.getDevice()).to.equal("Touch");
		});

		it("stops notifying a disconnected listener", () => {
			const input = createInput();
			let calls = 0;
			const disconnect = input.onDeviceChanged(() => calls++);

			input.began(pad(Enum.KeyCode.ButtonA));
			disconnect();
			input.began(key(Enum.KeyCode.E));

			expect(calls).to.equal(1);
		});
	});
};
