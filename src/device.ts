import { Device, deviceOfInputType, isThumbstick } from "./binding";
import { InputLike } from "./types";

export class DeviceWatcher {
	private readonly listeners = new Array<(device: Device) => void>();

	public constructor(
		private device: Device,
		private readonly stickDrift: number,
	) {}

	public get(): Device {
		return this.device;
	}

	public note(input: InputLike): void {
		const device = deviceOfInputType(input.UserInputType);
		if (device === undefined || device === this.device) {
			return;
		}
		if (isThumbstick(input.KeyCode) && input.Position.Magnitude < this.stickDrift) {
			return;
		}
		this.set(device);
	}

	public set(device: Device): void {
		if (device === this.device) {
			return;
		}
		this.device = device;
		for (const listener of table.clone(this.listeners)) {
			listener(device);
		}
	}

	public onChanged(listener: (device: Device) => void): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index !== -1) {
				this.listeners.remove(index);
			}
		};
	}
}
