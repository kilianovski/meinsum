import { IBlockLayerLink, IGptModelLink, ILayerNormLayerLink, IModelShape } from "./GptModel";
import { isNil } from "@/src/utils/data";
import { Mat4f } from "@/src/utils/matrix";
import { Dim, Vec3 } from "@/src/utils/vector";
import { IBufferTex } from "@/src/utils/renderPhases";
import { dimProps } from "./Annotations";
import { DimStyle } from "./walkthrough/WalkthroughTools";
import { IProgramState } from "./Program";
import { list } from "postcss";

export interface IBlkDef {
    idx: number; // index in the layout.cubes array
    t: 'w' | 'i' | 'a', // weights; intermediate value; aggregate (just LN & softmax)
    x: number;
    y: number;
    z: number;
    dx: number; // units: model-space
    dy: number;
    dz: number;
    cx: number; // units: number of cells
    cy: number;
    cz: number;
    access?: IBlkAccess;
    deps?: IBlkDeps;
    dimX: DimStyle;
    dimY: DimStyle;
    name: string;
    small: boolean; // small enough to not be worth rendering in large models
    // implicit dimZ = DimStyle.Batch for t === 'i'

    // fields that are post-added by the walk-through for various rendering configurations

    localMtx?: Mat4f; // for creating blocks that are sub-parts of a block
    // what to do for different axes?
    rangeOffsetsX?: [number, number][]; // if this block has been split, map from [[s0, xOff], [s1, xOff], ...] to the original block
    rangeOffsetsY?: [number, number][];
    rangeOffsetsZ?: [number, number][];
    highlight: number; // 0 - 1 (0 = no highlight, 1 = full highlight)
    opacity: number; // 0 - 1 (0 = transparent, 1 = opaque)
    special: BlkSpecial;
    transpose?: boolean; // transpose the process direction
    subs?: IBlkDef[]; // substitutes for this block (i.e. render these instead)
    offX?: number; // offset from the original block
    offY?: number;
    offZ?: number;
    sizeX?: number; // size of the sub block
    sizeY?: number;
    sizeZ?: number;
}

export enum BlkSpecial {
    None,
    Attention,
}

// define how a cell is computed from other blocks
// matrix-mulplication: cell(x, y, b) = sum_i(A[i, y] * B[x, i, b]) + C[0, y]
export interface IBlkDeps {
    dot?: [IBlkCellDep, IBlkCellDep];
    dotLen?: number;
    add?: IBlkCellDep[];
    special: BlKDepSpecial;
    lowerTri?: boolean;
}

export interface IBlkCellDep {
    src: IBlkDef;
    srcIdxMtx: Mat4f; // inputs: [x, y, b, [i]], outputs: [x, y, b]
}

interface IBlkDepArgs {
    dot?: [[IBlkDef, string], [IBlkDef, string]];
    dotLen?: number;
    add?: [IBlkDef, string][];
    lowerTri?: boolean; // only use the lower triangle of the matrix (causal attention matrices)
    special?: BlKDepSpecial;
}

export enum BlKDepSpecial {
    None,
    Softmax,
    Gelu,
    LayerNorm,
    InputEmbed,
    LayerNormMu,
    LayerNormSigma,
    SoftmaxAggMax,
    SoftmaxAggExp,
    Attention,
}

let depIdxVars = '0xybi';
function parseDepIdxStr(str: string): Mat4f {
    let mtx = Mat4f.zeros();
    for (let destI = 0; destI < str.length; destI++) {
        let srcIdx = depIdxVars.indexOf(str[destI]);
        if (srcIdx > 0) {
            mtx.s(destI, srcIdx - 1, 1.0);
        }
    }
    return mtx;
}

function depArgsToDeps(args: IBlkDepArgs): IBlkDeps {
    let makeBlkDeps = (src: IBlkDef, depStr: string) => ({ src, srcIdxMtx: parseDepIdxStr(depStr) });
    return {
        dot: args.dot && args.dot.map(([src, depStr]) => makeBlkDeps(src, depStr)) as [IBlkCellDep, IBlkCellDep],
        dotLen: args.dotLen,
        add: args.add && args.add.map(([src, depStr]) => makeBlkDeps(src, depStr)),
        special: args.special ?? BlKDepSpecial.None,
        lowerTri: args.lowerTri,
    };
}

export function getBlkDimensions(blk: IBlkDef) {
    let { x, y, z, dx, dy, dz } = blk;
    return {
        tl: new Vec3(x, y, z),
        br: new Vec3(x + dx, y + dy, z + dz),
    };
}

export function setBlkPosition(blk: IBlkDef, pos: Vec3) {
    blk.x = pos.x;
    blk.y = pos.y;
    blk.z = pos.z;
}

export interface IBlkAccess {
    src: IBufferTex;
    channel: 'r' | 'g' | 'b';
    scale: number;
    mat: Mat4f; // actually using the first two columns for a 3x2 matrix: mapping (x, y, z) integer cell coord to (x, y) src tex coord
    disable?: boolean;
}

interface IBlkAccessDefArgs {
    src?: IBufferTex;
    channel?: 'r' | 'g' | 'b';
    scale?: number;
    x: number[];
    y: number[];
}

interface IBlkDefArgs {
    t: 'w' | 'i' | 'a', // weights; intermediate value
    xL?: number; // pos of Left edge
    xR?: number; // Right
    xM?: number; // Middle
    zF?: number; // Front
    zB?: number; // Back
    zM?: number; // Middle
    name?: string;
    y: number;
    cx: number; // units: number of cells
    cz: number;
    cy: number;
    dimX: DimStyle;
    dimY: DimStyle;
    special?: BlkSpecial;
    access?: IBlkAccessDefArgs;
    deps?: IBlkDepArgs;
    small?: boolean;
    hidden?: boolean;
    transpose?: boolean;
}

export interface IBlkLabel {
    visible: number;
    cubes: IBlkDef[];
}

export interface IModelLayout {
    cell: number;
    height: number;
    margin: number;
    cubes: IBlkDef[];
}


interface IBlockDescription {
    frontUpLeft: Vec3,
    frontDownLeft: Vec3,
    frontUpRight: Vec3,
    rearUpLeft: Vec3
}

interface ICubeDescription {
    coords: Vec3,
    cx: number,
    cy: number
}

interface ITensorBlock {
    cubes: ICubeDescription[],
    blockDescription: IBlockDescription
}

function get_pad_lvl(n_dims: number): number {
    //     3 -> 0
    // 4,5,6 -> 1
    // 7,8,9 -> 2
    // ...
    return Math.ceil(n_dims / 3) - 1
}

let cell = 1.5;
let margin = 10;
let pad_lvl0 = 5;
let pad_multiplier = 3; // pad at lvl n = pad_lvl0*pad_multiplier^n


function generateTensor(dims: number[], start: Vec3 = new Vec3(),): ITensorBlock {
    const n_dims = dims.length;

    if (n_dims == 0) return generateTensor([1, 1], start);
    if (n_dims == 1) return generateTensor([dims[0], 1], start);

    if (n_dims == 2) {
        const [M, N] = dims;

        const cubes = [{
            coords: start,
            cy: M,
            cx: N,
        }];

        const blockDescription = {
            frontUpLeft: start,
            frontDownLeft: start.add(new Vec3(0, M)),
            frontUpRight: start.add(new Vec3(N)),
            rearUpLeft: start.add(new Vec3(0, 0, -1))
        }
        return {
            cubes,
            blockDescription,
        }
    }

    // recursive step
    const dimN = dims[0];
    const dimsNminusOne = dims.slice(1);

    let cubes: any[] = [];

    let blockStart = start.clone();

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
    */


    const pad_lvl = get_pad_lvl(n_dims);
    const pad = pad_lvl0 * Math.pow(pad_multiplier, pad_lvl);

    let ourBlockDescr: IBlockDescription = null;

    for (let q = 0; q < dimN; q++) {
        const block = generateTensor(dimsNminusOne, blockStart);
        cubes = cubes.concat(block.cubes);

        const d = block.blockDescription;

        if (q == 0) ourBlockDescr = d;

        if (n_dims % 3 == 0) {
            // move z
            blockStart = d.rearUpLeft.add(new Vec3(0, 0, -pad));
            ourBlockDescr.rearUpLeft = d.rearUpLeft;
        } else if (n_dims % 3 == 2) {
            // move along x axis
            blockStart = d.frontUpRight.add(new Vec3(pad));
            ourBlockDescr.frontUpRight = d.frontUpRight;
        } else {
            // move y ax
            blockStart = d.frontDownLeft.add(new Vec3(0, pad));
            ourBlockDescr.frontDownLeft = d.frontDownLeft;
        }

    }

    return {
        cubes,
        blockDescription: ourBlockDescr,
    }

}


export function cellPosition(layout: IModelLayout, blk: IBlkDef, dim: Dim, index: number) {
    let { x, rangeOffsets } = dimProps(blk, dim);
    let base = x + layout.cell * index;
    if (!rangeOffsets) {
        return base;
    }
    for (let [s, xOff] of rangeOffsets!) {
        if (index < s) {
            return base + xOff;
        }
    }
    return base;
}

export type IGptModelLayout = ReturnType<typeof genEinsumLayout>;
export type IGptLayerNormLayout = IGptModelLayout['ln_f'];



export function genEinsumLayout(state: IProgramState, offset: Vec3 = new Vec3(0, 0, 0)) {

    // work our way downwards from the top
    // x is to the left and right
    // y is positive going down, and the stack advances down from the top (at (0, 0, 0))
    // z is coming out of the page

    // a single batch of the residual pathway goes down the x-z plane
    // weights & off-residual pathways are left & right of the residual pathway (i.e. along x)
    // those blocks might have y-depth but that's OK: still have space to add batches
    // x = 0 is just to the left of time-cell t=0
    function mk(args: IBlkDefArgs): IBlkDef {
        let xDef = [args.xL, args.xR, args.xM].map(a => +!isNil(a)).reduce((a, b) => a + b, 0);
        let yDef = [args.zF, args.zB, args.zM].map(a => +!isNil(a)).reduce((a, b) => a + b, 0);
        if (xDef !== 1 || yDef !== 1) {
            throw new Error(`Must supply exactly 1 x arg & 1 y arg: ${JSON.stringify(args)}`);
        }
        let dx = args.cx * cell;
        let dy = args.cz * cell;
        let x = !isNil(args.xL) ? args.xL : !isNil(args.xR) ? args.xR - dx : args.xM! - dx / 2;
        let z = !isNil(args.zB) ? args.zB : !isNil(args.zF) ? args.zF - dy : args.zM! - dy / 2;

        function ensure4(a: number[]) {
            return a.length === 4 ? a : [...a, 0];
        }

        return {
            dx: args.cx * cell,
            dy: args.cy * cell,
            dz: args.cz * cell,
            t: args.t,
            x: x,
            y: args.y,
            z: z,
            cx: args.cx,
            cy: args.cy,
            cz: args.cz,
            dimX: args.dimX,
            dimY: args.dimY,
            name: args.name ?? "<unknown>",
            access: args.access?.src ? {
                channel: args.access.channel ?? 'r',
                src: args.access.src,
                scale: args.access.scale ?? 1.0,
                mat: Mat4f.fromColMajor([...ensure4(args.access.x), ...ensure4(args.access.y), 0, 0, 0, 0, 0, 0, 0, 0]),
            } : undefined,
            deps: args.deps ? depArgsToDeps(args.deps) : undefined,
            opacity: args.hidden ? 0.0 : 1.0,
            highlight: .0,
            small: args.small ?? false,
            special: args.special ?? BlkSpecial.None,
            transpose: args.transpose,
            idx: -1,
        };
    }

    function mkLabel(init: number, cubes?: IBlkDef[]): IBlkLabel {
        return { visible: 0, cubes: cubes ?? [] };
    }

    let cubes: IBlkDef[] = [];

    let cell = 1.5;
    let margin = 10;
    let pad_lvl0 = 3;
    let pad_multiplier = 3; // pad at lvl n = pad_lvl0*pad_multiplier^n
    let dim3_cell = 0.1;


    // const shapes = [[3, 8, 3, 8], [3, 8], [4, 3, 6], [16, 8], [8, 8]];
    const shapes = [
        [2, 3, 2, 2, 2, 5, 8, 16],
        [12, 40],
        // [2, 3, 4, 5, 6],
    ];
    let xL = 0;
    let zF = 0;
    let y = 0;

    let start_block_at = new Vec3();

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
        const block = generateTensor(dims, start_block_at);

        const blockCubes = block.cubes.map(c => cubes.push(mk({
            t: 'w',
            xL: c.coords.x, zF: c.coords.z, y: c.coords.y,
            cx: c.cx, cz: 1, cy: c.cy,
            // deps: deps,
            access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
            dimX: DimStyle.n_vocab, dimY: DimStyle.C,
            name: kwargs.name,
        })));

        start_block_at = block.blockDescription.frontUpRight.add(new Vec3(10));
    }


    let embedLabel = mkLabel(y, cubes);

    for (let i = 0; i < cubes.length; i++) {
        cubes[i].idx = i;
    }

    return {
        cubes,
        cell,
        margin,

        embedLabel,
        height: y,
        labels: [embedLabel],
    };
}
