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


    let y = 0;

    let cell = 1.5;
    let margin = Math.max(12, 10);
    let dim3_margin = 3;
    let dim3_cell = 0.1;

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


    const inputs = [];

    function parseShape(shape) {
        if (Array.isArray(shape)) {
            return shape;
        } else if (typeof shape === 'string') {
            return shape.split(',').map(Number);
        }
    }
    // for (let i = 0; i < state.inputs.length; ++i) {
    //     const {shape, name} = state.inputs[i];
    //     const actualShape = parseShape(shape);
    //     const cube = mk({
    //         t: 'w',
    //         xL: leftX + i*rightX, zM: 0, y: y,
    //         cx: actualShape[0], cy: actualShape[1], cz: 1,
    //         access: { src: gptGpuModel?.add.output, x: [0, 1, 0], y: [1, 0, T], scale: 10 },
    //         dimX: DimStyle.T, dimY: DimStyle.C,
    //         name: name,
    //     })

    //     inputs.push(cube)
    //     cubes.push(cube);
    // }


    // cubes.push(mC);
    const shapes = [[3, 8, 3, 8], [3,8], [4, 3, 6], [16, 8], [8, 8]];
    let xL = 0;

    for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        let deps = null;
        if (i == shapes.length - 1) {
            const last_cube = cubes[cubes.length - 1]
            const first_cube = cubes[0]

            deps = { add: [[last_cube, 'xi'], [first_cube, 'ix']] };
        };

        if (s.length > 2) {
            const dim1 = s[s.length-1];
            const dim2 = s[s.length-2];
            const dim3 = s[s.length-3];
            let zF = 0;

            for (let m = s.length - 4; m >= 0; m--) {
                const dimM = s[m];

                for (let q = 0; q < dimM; q++) {
                    
                    // 3rd dimension
                    
                    for (let k = 0; k < dim3; k++ ){
                        let m = mk({
                            t: 'w',
                            xL: xL, zF: zF, y: y,
                            cx: dim1, cz: 1, cy: dim2,
                            deps: deps,
                            access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
                            dimX: DimStyle.n_vocab, dimY: DimStyle.C,
                            name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
                        });
                        zF -= (dim3 * dim3_cell + dim3_margin)
                        cubes.push(m);
                    }
                    zF -= (10 * dim3 * dim3_cell + dim3_margin)
                }

            }


            dim3_label: {

            }

            if (s.length == 3) {
                // 3rd dimension
                let zF = 0;
                for (let k = 0; k < dim3; k++ ){
                    let m = mk({
                        t: 'w',
                        xL: xL, zF: zF, y: y,
                        cx: dim1, cz: 1, cy: dim2,
                        deps: deps,
                        access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
                        dimX: DimStyle.n_vocab, dimY: DimStyle.C,
                        name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
                    });
                    zF -= (dim3 * dim3_cell + dim3_margin)
                    cubes.push(m);
                }

                zF -= (dim3 * dim3_cell + dim3_margin)
            }


            xL += (s[0] * cell + margin);

        } else {
            let m = mk({
                t: 'w',
                xL: xL, zF: 0, y: y,
                cx: s[0], cz: 1, cy: s[1],
                deps: deps,
                access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
                dimX: DimStyle.n_vocab, dimY: DimStyle.C,
                name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
            });
            xL += (s[0] * cell + margin);
            cubes.push(m);
        }
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
