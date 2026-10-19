import { ActionName, InputConfig, InputMap, detectDevice, virtual } from "@skyzwrl/input";

const config = {
	contexts: {
		combat: {
			priority: 0,
			actions: {
				light: [Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR2, virtual("Light")],
				heavy: { bindings: [Enum.KeyCode.R, Enum.KeyCode.ButtonY, virtual("Heavy")], hold: 0.35 },
				dash: { bindings: [Enum.KeyCode.Q, Enum.KeyCode.ButtonB, virtual("Dash")], doubleTap: 0.25 },
				block: [Enum.KeyCode.F, Enum.KeyCode.ButtonL2],
				pause: [Enum.KeyCode.Escape, Enum.KeyCode.ButtonStart],
			},
			axes: {
				move: {
					type: "move",
					up: Enum.KeyCode.W,
					down: Enum.KeyCode.S,
					left: Enum.KeyCode.A,
					right: Enum.KeyCode.D,
					stick: Enum.KeyCode.Thumbstick1,
				},
				look: { type: "look", stick: Enum.KeyCode.Thumbstick2 },
			},
		},
		paused: {
			priority: 100,
			sink: "all",
			actions: {
				resume: [Enum.KeyCode.Escape, Enum.KeyCode.ButtonStart],
				select: [Enum.KeyCode.Return, Enum.KeyCode.ButtonA],
			},
		},
	},
	active: ["combat"],
} as const satisfies InputConfig;

export type Action = ActionName<typeof config>;

export const input = new InputMap(config, { device: detectDevice() });
