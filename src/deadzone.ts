const DIAGONAL = 1 / math.sqrt(2);

// radial rather than per axis so small diagonal tilts don't snap to a cardinal direction, and rescaled so
// the output still covers 0..1 once the stick leaves the deadzone
export function applyDeadzone(x: number, y: number, deadzone: number): Vector2 {
	const magnitude = math.sqrt(x * x + y * y);
	if (magnitude <= deadzone) {
		return Vector2.zero;
	}
	const scale = math.min((magnitude - deadzone) / (1 - deadzone), 1) / magnitude;
	return new Vector2(x * scale, y * scale);
}

export function digitalVector(x: number, y: number): Vector2 {
	if (x !== 0 && y !== 0) {
		return new Vector2(x * DIAGONAL, y * DIAGONAL);
	}
	return x === 0 && y === 0 ? Vector2.zero : new Vector2(x, y);
}
