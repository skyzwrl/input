export type Device = "KeyboardMouse" | "Gamepad" | "Touch";

// on-screen buttons the game draws itself, pressed through InputMap.pressVirtual
export interface VirtualButton {
	readonly virtual: string;
}

export type Binding = Enum.KeyCode | Enum.UserInputType | VirtualButton;

const MOUSE_BUTTONS = new Set<Enum.UserInputType>([
	Enum.UserInputType.MouseButton1,
	Enum.UserInputType.MouseButton2,
	Enum.UserInputType.MouseButton3,
]);

const GAMEPADS = new Set<Enum.UserInputType>([
	Enum.UserInputType.Gamepad1,
	Enum.UserInputType.Gamepad2,
	Enum.UserInputType.Gamepad3,
	Enum.UserInputType.Gamepad4,
	Enum.UserInputType.Gamepad5,
	Enum.UserInputType.Gamepad6,
	Enum.UserInputType.Gamepad7,
	Enum.UserInputType.Gamepad8,
]);

const KEYBOARD_AND_MOUSE = new Set<Enum.UserInputType>([
	Enum.UserInputType.Keyboard,
	Enum.UserInputType.MouseButton1,
	Enum.UserInputType.MouseButton2,
	Enum.UserInputType.MouseButton3,
	Enum.UserInputType.MouseMovement,
	Enum.UserInputType.MouseWheel,
]);

const keys = new Map<EnumItem, string>();
const virtualButtons = new Map<string, VirtualButton>();

export function virtual(name: string): VirtualButton {
	let button = virtualButtons.get(name);
	if (button === undefined) {
		button = { virtual: name };
		virtualButtons.set(name, button);
	}
	return button;
}

export function isThumbstick(keyCode: Enum.KeyCode): boolean {
	return keyCode === Enum.KeyCode.Thumbstick1 || keyCode === Enum.KeyCode.Thumbstick2;
}

export function isMouseButton(inputType: Enum.UserInputType): boolean {
	return MOUSE_BUTTONS.has(inputType);
}

// tostring on an Enum differs between Roblox ("KeyCode") and Lune ("Enum.KeyCode"), so keys are built by hand
export function enumKey(item: Enum.KeyCode | Enum.UserInputType): string {
	let key = keys.get(item);
	if (key === undefined) {
		key = (item.EnumType === Enum.KeyCode ? "KeyCode." : "UserInputType.") + item.Name;
		keys.set(item, key);
	}
	return key;
}

export function bindingKey(binding: Binding): string {
	return typeIs(binding, "EnumItem") ? enumKey(binding) : `Virtual.${binding.virtual}`;
}

export function isBindable(binding: Binding): boolean {
	if (!typeIs(binding, "EnumItem")) {
		return binding.virtual !== "";
	}
	if (binding.EnumType === Enum.KeyCode) {
		return binding !== Enum.KeyCode.None && !isThumbstick(binding as Enum.KeyCode);
	}
	return isMouseButton(binding as Enum.UserInputType);
}

export function parseBinding(key: string): Binding | undefined {
	const [kind, name] = key.match("^(%a+)%.(.+)$");
	if (!typeIs(kind, "string") || !typeIs(name, "string")) {
		return undefined;
	}

	let binding: Binding | undefined;
	if (kind === "KeyCode") {
		binding = Enum.KeyCode.FromName(name) as Enum.KeyCode | undefined;
	} else if (kind === "UserInputType") {
		binding = Enum.UserInputType.FromName(name) as Enum.UserInputType | undefined;
	} else if (kind === "Virtual") {
		binding = virtual(name);
	}
	return binding !== undefined && isBindable(binding) ? binding : undefined;
}

export function deviceOfBinding(binding: Binding): Device {
	if (!typeIs(binding, "EnumItem")) {
		return "Touch";
	}
	if (binding.EnumType === Enum.UserInputType) {
		return "KeyboardMouse";
	}
	const name = binding.Name;
	const gamepad = name.sub(1, 6) === "Button" || name.sub(1, 4) === "DPad" || name.sub(1, 10) === "Thumbstick";
	return gamepad ? "Gamepad" : "KeyboardMouse";
}

export function deviceOfInputType(inputType: Enum.UserInputType): Device | undefined {
	if (KEYBOARD_AND_MOUSE.has(inputType)) {
		return "KeyboardMouse";
	} else if (GAMEPADS.has(inputType)) {
		return "Gamepad";
	} else if (inputType === Enum.UserInputType.Touch) {
		return "Touch";
	}
	return undefined;
}
