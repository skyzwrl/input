import { RunService, UserInputService } from "@rbxts/services";
import { Device, deviceOfInputType } from "./binding";
import { InputLike } from "./types";

export interface InputReceiver {
	began(input: InputLike, gameProcessed?: boolean): void;
	changed(input: InputLike, gameProcessed?: boolean): void;
	ended(input: InputLike): void;
	update(): void;
	releaseAll(): void;
}

export function detectDevice(): Device {
	const device = deviceOfInputType(UserInputService.GetLastInputType());
	if (device !== undefined) {
		return device;
	}
	return UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled ? "Touch" : "KeyboardMouse";
}

export function bindUserInput(receiver: InputReceiver): () => void {
	const connections = [
		UserInputService.InputBegan.Connect((input, gameProcessed) => receiver.began(input, gameProcessed)),
		UserInputService.InputChanged.Connect((input, gameProcessed) => receiver.changed(input, gameProcessed)),
		UserInputService.InputEnded.Connect((input) => receiver.ended(input)),
		// key ups that happen while the window is unfocused never arrive, so let go of everything instead
		UserInputService.WindowFocusReleased.Connect(() => receiver.releaseAll()),
		RunService.PreRender.Connect(() => receiver.update()),
	];

	return () => {
		for (const connection of connections) {
			connection.Disconnect();
		}
	};
}
