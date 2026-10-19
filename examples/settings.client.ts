import { ReplicatedStorage } from "@rbxts/services";
import { Binding } from "@skyzwrl/input";
import { Action, input } from "./controls";

const saveControls = ReplicatedStorage.WaitForChild("SaveControls") as RemoteEvent;
const controlsLoaded = ReplicatedStorage.WaitForChild("ControlsLoaded") as RemoteEvent;

controlsLoaded.OnClientEvent.Connect((saved: unknown) => {
	for (const problem of input.loadBindings(saved)) {
		warn(`controls: ${problem}`);
	}
});

// the settings menu calls this after the player presses a new key; returns an error to show, if any
export function rebindFromMenu(action: Action, binding: Binding, swap: boolean): string | undefined {
	const result = input.rebind(action, binding, { swap });
	if (!result.ok) {
		return result.reason === "Conflict" ? `already used by ${result.conflict}` : "that input can't be bound";
	}
	saveControls.FireServer(input.saveBindings());
	return undefined;
}

export function resetControls(): void {
	input.resetAll();
	saveControls.FireServer(input.saveBindings());
}
