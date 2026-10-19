import { Players, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { bindUserInput } from "@skyzwrl/input";
import { input } from "./controls";

const swing = ReplicatedStorage.WaitForChild("Swing") as RemoteEvent;

bindUserInput(input);

input.on("light", "began", () => swing.FireServer("light"));
input.on("heavy", "tapped", () => swing.FireServer("heavyTap"));
input.on("heavy", "held", () => swing.FireServer("heavyCharge"));
input.on("heavy", "ended", (event) => {
	if (!event.cancelled && event.heldFor >= 0.35) {
		swing.FireServer("heavyRelease");
	}
});
input.on("dash", "doubleTapped", () => swing.FireServer("dash"));
input.on("block", "began", () => swing.FireServer("blockStart"));
input.on("block", "ended", () => swing.FireServer("blockEnd"));

let resume: (() => void) | undefined;
input.on("pause", "began", () => {
	resume = input.push("paused");
});
input.on("resume", "began", () => {
	resume?.();
	resume = undefined;
});

// the game's own UI reads this to swap button prompts
input.onDeviceChanged((device) => Players.LocalPlayer.SetAttribute("InputDevice", device));

let yaw = 0;
let pitch = 0;

RunService.PreRender.Connect((deltaTime) => {
	const character = Players.LocalPlayer.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = humanoid?.RootPart;
	const camera = Workspace.CurrentCamera;
	if (!humanoid || !root || !camera) {
		return;
	}

	const look = input.consumeLook("look", deltaTime);
	yaw -= look.X;
	pitch = math.clamp(pitch + look.Y, -1.2, 1.2);
	const orbit = CFrame.fromOrientation(pitch, yaw, 0);
	camera.CFrame = new CFrame(root.Position).mul(orbit).mul(new CFrame(0, 2, 12));

	const move = input.getMove("move");
	humanoid.Move(new Vector3(move.X, 0, -move.Y), true);
});
