import { Vec3 } from "../utils/vector";

/* Design decisions for Vec3/Vec4

Methods have immutable behavior (rather than in-place) for less error-prone usage, but that naturally
means a drop in perf. Happy with this trade.
All methods only have at most 1 new Vec*, even if it means a bit more repetition.

Fact-check: false:
    Inheriting from Array<number> seems to give good structure in V8. In particular, the number array
    elements (as doubles) are inline in the array, and the initialization with the size means the array
    is actually that size. It looks like there's an extra pointer hop from this class to get to the
    actual array data which is not strictly ideal, but better than both Float64Array and 3 pointer hops
    in the case of { x: number, y: number, z: number } (V8 doesn't do double de-boxing :( ).

Probably due to inhieriting from Array<number>, the constructor is painfully slow, showing up in
stack traces.

Back to simple objects, on the idea that ones that live on the stack will get jitted away anyway.

V8 shows Vec3 & Vec4 as having an 24 byte overhead, which... isn't toooo bad

*/

// import { clamp } from "./data";

enum Dim {
    X = 0,
    Y = 1,
    Z = 2,
}

class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0) {
        this.x = +x;
        this.y = +y;
        this.z = +z;
    }

    add(a: Vec3): Vec3 { return new Vec3(this.x + a.x, this.y + a.y, this.z + a.z); }
    sub(a: Vec3): Vec3 { return new Vec3(this.x - a.x, this.y - a.y, this.z - a.z); }
    dot(a: Vec3): number { return this.x * a.x + this.y * a.y + this.z * a.z; }
    mul(a: number): Vec3 { return new Vec3(this.x * a, this.y * a, this.z * a); }
    mulAdd(a: Vec3, b: number): Vec3 { return new Vec3(this.x + a.x * b, this.y + a.y * b, this.z + a.z * b); }
    lenSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
    distSq(a: Vec3): number {
        let dx = this.x - a.x;
        let dy = this.y - a.y;
        let dz = this.z - a.z;
        return dx * dx + dy * dy + dz * dz;
    }
    len(): number { return Math.sqrt(this.lenSq()); }
    dist(a: Vec3): number { return Math.sqrt(this.distSq(a)); }
    normalize(): Vec3 { return this.mul(1.0 / Math.sqrt(this.lenSq())); }
    mid(a: Vec3): Vec3 { return new Vec3((this.x + a.x) * 0.5, (this.y + a.y) * 0.5, (this.z + a.z) * 0.5); }
    abs() { return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); }
    clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }
    round(): Vec3 { return new Vec3(Math.round(this.x), Math.round(this.y), Math.round(this.z)); }
    round_(): Vec3 { this.x = Math.round(this.x); this.y = Math.round(this.y); this.z = Math.round(this.z); return this; }
    copy_(a: Vec3) { this.x = a.x; this.y = a.y; this.z = a.z; }
    static cross(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x);
    }
    writeToBuf(buf: Float32Array, offset: number) {
        buf[offset + 0] = this.x;
        buf[offset + 1] = this.y;
        buf[offset + 2] = this.z;
    }
    static fromArray(a: ArrayLike<number>, offset: number = 0): Vec3 {
        return new Vec3(a[offset + 0], a[offset + 1], a[offset + 2]);
    }
    setAt(i: number, v: number) {
        switch (i) {
            case 0: this.x = v; break;
            case 1: this.y = v; break;
            case 2: this.z = v; break;
        }
        return this;
    }
    addAt(i: number, v: number) {
        switch (i) {
            case 0: this.x += v; break;
            case 1: this.y += v; break;
            case 2: this.z += v; break;
        }
        return this;
    }
    getAt(i: number): number {
        switch (i) {
            case 0: return this.x;
            case 1: return this.y;
            case 2: return this.z;
        }
        return 0.0;
    }
    withSetAt(i: number, v: number): Vec3 { return this.clone().setAt(i, v); }
    withAddAt(i: number, v: number): Vec3 { return this.clone().addAt(i, v); }

    rotateAbout(k: Vec3, thetaRad: number) {
        // https://en.wikipedia.org/wiki/Rodrigues%27_rotation_formula
        // k must have unit length
        let c = Math.cos(thetaRad);
        let s = Math.sin(thetaRad);
        let kCrossV = Vec3.cross(k, this);
        let kDotV = k.dot(this);
        return this.mul(c).add(kCrossV.mul(s)).add(k.mul(kDotV * (1 - c)));
    }
    lerp(a: Vec3, t: number): Vec3 {
        return new Vec3(
            a.x * t + this.x * (1 - t),
            a.y * t + this.y * (1 - t),
            a.z * t + this.z * (1 - t),
        );
    }
    static zero = new Vec3(0, 0, 0);
    static one = new Vec3(1, 1, 1);
}

/*
let cubes: IBlkDef[] = [];

let cell = 1.5;
let margin = 10;
let pad_lvl0 = 3;
let pad_multiplier = 3; // pad at lvl n = pad_lvl0*pad_multiplier^n
let dim3_cell = 0.1;


// const shapes = [[3, 8, 3, 8], [3, 8], [4, 3, 6], [16, 8], [8, 8]];
const shapes = [
    [4, 8, 16],
    [12, 40],
    // [2, 3, 4, 5, 6],
];
let xL = 0;
let zF = 0;
let y = 0;

function get_pad_lvl(n_dims) {
    //     3 -> 0
    // 4,5,6 -> 1
    // 7,8,9 -> 2
    // ...
    return Math.ceil(n_dims / 3) - 1
}

function drawCubes(dims: number[], kwargs: object) {
    const n_dims = dims.length;

    if (n_dims == 0) drawCubes([1, 1], kwargs);
    if (n_dims == 1) drawCubes([dims[0], 1], kwargs);

    // single base case
    if (n_dims == 2) {
        const [M, N] = dims;
        let m = mk({
            t: 'w',
            xL: xL, zF: zF, y: y,
            cx: N, cz: 1, cy: M,
            // deps: deps,
            access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
            dimX: DimStyle.n_vocab, dimY: DimStyle.C,
            name: kwargs.name,
        });

        cubes.push(m);

        // xL += N * cell;
        // y += M * cell;
        return;
    }

    // recursive step
    const dimN = dims[0];
    const dimsNminusOne = dims.slice(1);
    for (let q = 0; q < dimN; q++) {
        drawCubes(dimsNminusOne, kwargs);
        // do padding;
        /*
        we have axis rotation: 
            - 3rd dim along z axis | pad_lvl 0
            * UPGRADE padding..
            - 4th dim along y axis | pad_lvl 1
            - 5th dim along x axis | pad_lvl 1
            - 6th dim along z axis | pad_lvl 1
            * UPGRADE padding..
            - 7th dim along y axis | pad_lvl 2
            ...
        // 
const N = dims[n_dims - 1];
xL -= N * cell;
const pad_lvl = get_pad_lvl(n_dims);
const pad = pad_lvl0 * Math.pow(pad_multiplier, pad_lvl);

if (n_dims % 3 == 0) {
    zF -= pad;
    console.log('n_dims', n_dims)
} else if (n_dims % 3 == 1) {
    y += pad;
} else {
    xL += pad;
}

    }

}

for (let i = 0; i < shapes.length; i++) {
    const dims = shapes[i];
    let deps = null;
    if (i == shapes.length - 1) {
        const last_cube = cubes[cubes.length - 1]
        const first_cube = cubes[0]

        deps = { add: [[last_cube, 'xi'], [first_cube, 'ix']] };
    };

    const kwargs = {
        name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
    }
    drawCubes(dims, kwargs);
    xL += margin;
}

*/

function generateTensor(dims: number[], start: Vec3 = new Vec3(),) {
    const n_dims = dims.length;



    if (n_dims == 0) return generateTensor([1, 1], start);
    if (n_dims == 1) return generateTensor([dims[0], 1], start);

    if (n_dims == 2) {
        const [M, N] = dims;

        const cubes = [{
            coords: start,
            cx: M,
            cy: N, // TODO: verify you are correct
        }];

        const blockDescription = {
            frontUpLeft: start,
            frontUpRight: start.add(new Vec3(N)),
            rearUpLeft: start.add(new Vec3(0, 0, 1))
        }
        return {
            cubes,
            blockDescription,
        }
    }
}

console.log(generateTensor([]))
