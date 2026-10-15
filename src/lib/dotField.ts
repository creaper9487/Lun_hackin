// The halftone dots of a project card, as real dots. Each dot has an identity: now and then a dot swaps places
// with a neighbour (the two curve around each other), and now and then a dot turns blue or red and later
// fades back to black. Black-for-black swaps are invisible by design, so most hops start from a coloured dot.

const SPACING = 11;
const MOVE_MS = 1000;
const COLOR_MS = 520;
const TAU = Math.PI * 2;

// [r, g, b, alpha, radius]
type Look = [number, number, number, number, number];
const BLUE: Look = [35, 66, 224, 0.95, 2.86];
const RED: Look = [229, 23, 79, 0.95, 2.86];
const HUES = [BLUE, RED];

// Under-damped spring from 0 to 1 (damping ratio 0.55): a dot glides in, overshoots a hair and settles.
const ZETA = 0.55;
const OMEGA = 9;
const OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);
const settle = (t: number) => 1 - Math.exp(-ZETA * OMEGA * t) * (Math.cos(OMEGA_D * t) + ((ZETA * OMEGA) / OMEGA_D) * Math.sin(OMEGA_D * t));

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class DotField {
	private ctx: CanvasRenderingContext2D;
	private W = 0;
	private H = 0;
	private dpr = 1;
	private cols = 0;
	private rows = 0;
	private base: Look = [23, 18, 38, 0.18, 1.625];

	// per dot
	private x = new Float32Array(0);
	private y = new Float32Array(0);
	private fromX = new Float32Array(0);
	private fromY = new Float32Array(0);
	private toX = new Float32Array(0);
	private toY = new Float32Array(0);
	private side = new Int8Array(0);
	private move = new Float32Array(0); // 0..1, 1 = at rest
	private mix = new Float32Array(0); // 0..1 colour tween, 1 = settled
	private from = new Float32Array(0); // 5 numbers per dot
	private to = new Float32Array(0);
	private expires = new Float64Array(0);
	private coloured = new Uint8Array(0);
	private slot = new Int32Array(0); // slot -> dot
	private slotOf = new Int32Array(0); // dot -> slot
	private list: number[] = []; // coloured dots
	private listIndex = new Int32Array(0);

	private paintDebt = 0;
	private swapDebt = 0;

	constructor(
		private canvas: HTMLCanvasElement,
		ctx: CanvasRenderingContext2D,
		private animated: boolean,
	) {
		this.ctx = ctx;
		if (canvas.dataset.tone === 'blue') this.base = [23, 18, 38, 0.25, 1.625];
	}

	layout() {
		const rect = this.canvas.getBoundingClientRect();
		if (!rect.width || !rect.height) return false;
		this.W = rect.width;
		this.H = rect.height;
		this.dpr = Math.min(2, devicePixelRatio || 1);
		this.canvas.width = Math.round(this.W * this.dpr);
		this.canvas.height = Math.round(this.H * this.dpr);
		this.cols = Math.ceil(this.W / SPACING) + 1;
		this.rows = Math.ceil(this.H / SPACING) + 1;
		const n = this.cols * this.rows;

		this.x = new Float32Array(n);
		this.y = new Float32Array(n);
		this.fromX = new Float32Array(n);
		this.fromY = new Float32Array(n);
		this.toX = new Float32Array(n);
		this.toY = new Float32Array(n);
		this.side = new Int8Array(n);
		this.move = new Float32Array(n).fill(1);
		this.mix = new Float32Array(n).fill(1);
		this.from = new Float32Array(n * 5);
		this.to = new Float32Array(n * 5);
		this.expires = new Float64Array(n);
		this.coloured = new Uint8Array(n);
		this.slot = new Int32Array(n);
		this.slotOf = new Int32Array(n);
		this.listIndex = new Int32Array(n).fill(-1);
		this.list = [];

		for (let i = 0; i < n; i++) {
			this.slot[i] = i;
			this.slotOf[i] = i;
			this.x[i] = this.slotX(i);
			this.y[i] = this.slotY(i);
			this.setLook(this.to, i, this.base);
			this.setLook(this.from, i, this.base);
		}
		// a static card still shows a few coloured dots
		if (!this.animated) {
			for (let k = 0; k < n * 0.02; k++) this.paint(0, Math.floor(Math.random() * n), true);
		}
		return true;
	}

	private slotX = (s: number) => (s % this.cols) * SPACING + SPACING / 2;
	private slotY = (s: number) => Math.floor(s / this.cols) * SPACING + SPACING / 2;

	private setLook(target: Float32Array, dot: number, look: Look) {
		for (let k = 0; k < 5; k++) target[dot * 5 + k] = look[k];
	}

	// current look of a dot, mid-tween included
	private currentLook(dot: number): Look {
		const e = ease(this.mix[dot]);
		const out = [0, 0, 0, 0, 0] as Look;
		for (let k = 0; k < 5; k++) out[k] = this.from[dot * 5 + k] + (this.to[dot * 5 + k] - this.from[dot * 5 + k]) * e;
		return out;
	}

	private retarget(dot: number, look: Look) {
		const current = this.currentLook(dot);
		for (let k = 0; k < 5; k++) this.from[dot * 5 + k] = current[k];
		this.setLook(this.to, dot, look);
		this.mix[dot] = 0;
	}

	private addColoured(dot: number) {
		if (this.coloured[dot]) return;
		this.coloured[dot] = 1;
		this.listIndex[dot] = this.list.length;
		this.list.push(dot);
	}

	private removeColoured(dot: number) {
		if (!this.coloured[dot]) return;
		this.coloured[dot] = 0;
		const at = this.listIndex[dot];
		const last = this.list.pop()!;
		if (last !== dot) {
			this.list[at] = last;
			this.listIndex[last] = at;
		}
		this.listIndex[dot] = -1;
	}

	private paint(now: number, dot: number, instant = false) {
		const look = HUES[Math.random() < 0.5 ? 0 : 1];
		this.addColoured(dot);
		if (instant) {
			this.setLook(this.from, dot, look);
			this.setLook(this.to, dot, look);
			this.mix[dot] = 1;
		} else {
			this.retarget(dot, look);
		}
		this.expires[dot] = now + 1800 + Math.random() * 4200;
	}

	private swap(slotA: number, slotB: number) {
		const a = this.slot[slotA];
		const b = this.slot[slotB];
		if (this.move[a] < 1 || this.move[b] < 1) return;
		for (const [dot, target, dir] of [
			[a, slotB, 1],
			[b, slotA, -1],
		] as const) {
			this.fromX[dot] = this.x[dot];
			this.fromY[dot] = this.y[dot];
			this.toX[dot] = this.slotX(target);
			this.toY[dot] = this.slotY(target);
			this.side[dot] = dir;
			this.move[dot] = 0;
			this.slotOf[dot] = target;
		}
		this.slot[slotA] = b;
		this.slot[slotB] = a;
	}

	private neighbour(s: number) {
		const c = s % this.cols;
		const r = Math.floor(s / this.cols);
		const dirs: [number, number][] = [];
		if (c > 0) dirs.push([-1, 0]);
		if (c < this.cols - 1) dirs.push([1, 0]);
		if (r > 0) dirs.push([0, -1]);
		if (r < this.rows - 1) dirs.push([0, 1]);
		const [dc, dr] = dirs[Math.floor(Math.random() * dirs.length)];
		return (r + dr) * this.cols + c + dc;
	}

	step(dt: number, now: number) {
		const n = this.x.length;
		if (!n) return;

		// new coloured dots, in proportion to how many dots the card has (about 1 in 155 per second)
		this.paintDebt += (dt * n * 0.9) / 140;
		while (this.paintDebt >= 1) {
			this.paintDebt--;
			const dot = Math.floor(Math.random() * n);
			if (!this.coloured[dot]) this.paint(now, dot);
		}

		// coloured dots that have had their time go back to black (or occasionally jump to the other colour)
		for (let i = this.list.length - 1; i >= 0; i--) {
			const dot = this.list[i];
			if (now < this.expires[dot]) continue;
			if (Math.random() < 0.25) {
				this.retarget(dot, this.to[dot * 5] === BLUE[0] ? RED : BLUE);
				this.expires[dot] = now + 1500 + Math.random() * 3000;
			} else {
				this.retarget(dot, this.base);
				this.removeColoured(dot);
			}
		}

		// hops: mostly coloured dots, so the movement can be seen
		this.swapDebt += dt * (this.list.length * 0.25 + 1) * 0.9;
		while (this.swapDebt >= 1) {
			this.swapDebt--;
			const dot = this.list.length && Math.random() < 0.8 ? this.list[Math.floor(Math.random() * this.list.length)] : Math.floor(Math.random() * n);
			const from = this.slotOf[dot];
			this.swap(from, this.neighbour(from));
		}
	}

	draw(dt: number) {
		if (!this.x.length) return;
		const { ctx, W, H, dpr } = this;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const n = this.x.length;
		const b = this.base;
		const special: number[] = [];

		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			if (this.move[i] < 1) {
				this.move[i] = Math.min(1, this.move[i] + dt / MOVE_MS);
				const e = this.move[i] >= 1 ? 1 : settle(this.move[i]);
				const dx = this.toX[i] - this.fromX[i];
				const dy = this.toY[i] - this.fromY[i];
				const len = Math.hypot(dx, dy) || 1;
				const arc = Math.sin(Math.PI * e) * SPACING * 0.45 * this.side[i];
				this.x[i] = this.fromX[i] + dx * e - (dy / len) * arc;
				this.y[i] = this.fromY[i] + dy * e + (dx / len) * arc;
			}
			if (this.mix[i] < 1) this.mix[i] = Math.min(1, this.mix[i] + dt / COLOR_MS);
			if (this.coloured[i] || this.move[i] < 1 || this.mix[i] < 1) {
				special.push(i);
				continue;
			}
			ctx.moveTo(this.x[i] + b[4], this.y[i]);
			ctx.arc(this.x[i], this.y[i], b[4], 0, TAU);
		}
		ctx.fillStyle = `rgba(${b[0]},${b[1]},${b[2]},${b[3]})`;
		ctx.fill();

		for (const i of special) {
			const [r, g, bl, a, radius] = this.currentLook(i);
			ctx.beginPath();
			ctx.arc(this.x[i], this.y[i], radius, 0, TAU);
			ctx.fillStyle = `rgba(${r | 0},${g | 0},${bl | 0},${a})`;
			ctx.fill();
		}
	}
}

export function initDotFields(canvases: Iterable<HTMLCanvasElement>) {
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');
	const running = new Set<DotField>();
	let raf = 0;
	let last = 0;

	function loop(now: number) {
		raf = 0;
		if (!running.size || document.hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		for (const field of running) {
			field.step(dt, now);
			field.draw(dt * 1000);
		}
		raf = requestAnimationFrame(loop);
	}
	function wake() {
		if (!raf && running.size && !document.hidden) {
			last = performance.now();
			raf = requestAnimationFrame(loop);
		}
	}
	document.addEventListener('visibilitychange', wake);

	for (const canvas of canvases) {
		const ctx = canvas.getContext('2d');
		if (!ctx) continue;
		const field = new DotField(canvas, ctx, !reduce.matches);
		const card = canvas.parentElement;
		let ready = false;

		new ResizeObserver(() => {
			if (!field.layout()) return;
			if (!ready) card?.classList.add('has-dots');
			ready = true;
			if (reduce.matches) field.draw(0);
		}).observe(canvas);

		// only cards on screen animate
		new IntersectionObserver((entries) => {
			if (reduce.matches) return;
			if (entries[0].isIntersecting) running.add(field);
			else running.delete(field);
			wake();
		}).observe(canvas);
	}
}
