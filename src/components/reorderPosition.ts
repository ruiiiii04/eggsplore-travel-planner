export function reorderPosition(index: number, delta: number, height: number, min: number, max: number) {
 if (!Number.isFinite(delta) || !Number.isFinite(height) || height <= 0) return index;
 const steps = Math.sign(delta) * Math.floor(Math.abs(delta) / height + 0.5);
 return Math.max(min, Math.min(max, index + steps));
}
