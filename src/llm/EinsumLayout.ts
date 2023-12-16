import { IBlockLayerLink, IGptModelLink, ILayerNormLayerLink, IModelShape } from "./GptModel";
import { isNil } from "@/src/utils/data";
import { Mat4f } from "@/src/utils/matrix";
import { Dim, Vec3 } from "@/src/utils/vector";
import { IBufferTex } from "@/src/utils/renderPhases";
import { dimProps } from "./Annotations";
import { DimStyle } from "./walkthrough/WalkthroughTools";

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

export function genEinsumLayout(shape: IModelShape, gptGpuModel: IGptModelLink | null = null, offset: Vec3 = new Vec3(0, 0, 0)) {
    let { B, T, C, vocabSize, nHeads, A, nBlocks } = shape;

    // work our way downwards from the top
    // x is to the left and right
    // y is positive going down, and the stack advances down from the top (at (0, 0, 0))
    // z is coming out of the page

    // a single batch of the residual pathway goes down the x-z plane
    // weights & off-residual pathways are left & right of the residual pathway (i.e. along x)
    // those blocks might have y-depth but that's OK: still have space to add batches
    // x = 0 is just to the left of time-cell t=0

    let isLargeModel = shape.nBlocks > 12;

    let y = 0;

    let cell = 1.5;
    let margin = Math.max(12, C / 10);

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
            highlight: 0.0,
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

    let idxObj = mk({
        t: 'i', cx: T, cz: B, cy: 1, y: y,
        xM: 0, zM: 0,
        access: { src: gptGpuModel?.inputTokens, x: [0, 1, 0], y: [1, 0, T], scale: 1 / vocabSize},
        dimX: DimStyle.T, dimY: DimStyle.None,
        name: 'Tokens',
    });

    let leftX = -T * cell / 2 - margin;
    let rightX = T * cell / 2 + margin;

    y += cell + margin;

    let tokEmbedObj = mk({
        t: 'w',
        xR: leftX, zM: 0, y: y,
        cx: vocabSize, cz: 1, cy: C, // src has shape [vocabSize, C]
        access: { src: gptGpuModel?.vocabEmbed.weight, x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
        dimX: DimStyle.n_vocab, dimY: DimStyle.C,
        name: 'Token Embed',
    });

    let posEmbedObj = mk({
        t: 'w',
        xL: rightX, zM: 0, y: y,
        cx: T, cz: 1, cy: C,
        access: { src: gptGpuModel?.posEmbed.weight, x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
        dimX: DimStyle.T, dimY: DimStyle.C,
        name: 'Position Embed',
    });

    let residual0 = mk({
        t: 'i',
        xM: 0, zM: 0, y: y,
        cx: T, cz: B, cy: C,
        access: { src: gptGpuModel?.add.output, x: [0, 1, 0], y: [1, 0, T], scale: 10 },
        deps: { add: [[tokEmbedObj, 'iy'], [posEmbedObj, 'xy']], special: BlKDepSpecial.InputEmbed }, // the i comes from the idxObj lookup
        dimX: DimStyle.T, dimY: DimStyle.C,
        name: 'Input Embed',
    });
    cubes.push(tokEmbedObj, posEmbedObj, residual0);

    let embedLabel = mkLabel(y, [tokEmbedObj, posEmbedObj, residual0]);

    y += C * cell + margin;

    function createLn(x: number, src: IBlkDef, target?: ILayerNormLayerLink) {
        let lnLeftX = leftX + x;
        let resLeftX = lnLeftX - T * cell - margin;

        let lnAgg1 = mk({
            t: 'a', cx: T, cz: B, cy: 1, y: y,
            xR: lnLeftX, zM: 0,
            access: { src: target?.normAgg, x: [0, 1, 0], y: [1, 0, T], scale: 10.0, channel: 'r' },
            deps: { add: [[src, 'xi']], special: BlKDepSpecial.LayerNormMu },
            dimX: DimStyle.T, dimY: DimStyle.None, small: true,
            name: 'LN Agg: μ, σ',
        });
        let lnAgg2 = mk({
            t: 'a', cx: T, cz: B, cy: 1, y: y + cell,
            xR: lnLeftX, zM: 0,
            access: { src: target?.normAgg, x: [0, 1, 0], y: [1, 0, T], scale: 10.0, channel: 'g' },
            deps: { add: [[src, 'xi']], special: BlKDepSpecial.LayerNormSigma },
            dimX: DimStyle.T, dimY: DimStyle.None, small: true,
            name: '',
        });

        y += 2 * cell + margin;

        let lnSigma = mk({
            t: 'w', cx: 1, cz: 1, cy: C, y: y,
            xR: resLeftX, zM: 0,
            access: { src: target?.normWeight, x: [1, 0, 0], y: [0, 1, 0], scale: 0.5 }, // mostly around 1.0
            dimX: DimStyle.None, dimY: DimStyle.C,
            name: 'γ', small: true,
        });
        let lnMu = mk({
            t: 'w', cx: 1, cz: 1, cy: C, y: y,
            xR: resLeftX - cell * 1 - margin, zM: 0,
            access: { src: target?.normBias, x: [1, 0, 0], y: [0, 1, 0] },
            dimX: DimStyle.None, dimY: DimStyle.C,
            name: 'β', small: true,
        });
        let lnResid = mk({
            t: 'i', cx: T, cz: B, cy: C, y: y,
            xR: lnLeftX, zM: 0,
            access: { src: target?.output, x: [0, 1, 0], y: [1, 0, T], scale: 1.0 },
            deps: { add: [[src, 'xy'], [lnAgg1, 'xi'], [lnAgg2, 'xi'], [lnSigma, '0y'], [lnMu, '0y']], special: BlKDepSpecial.LayerNorm }, // lnSigma is really mul rather than add
            dimX: DimStyle.T, dimY: DimStyle.C,
            name: 'Layer Norm',
        });
        let lnCubes = [lnAgg1, lnAgg2, lnSigma, lnMu, lnResid];
        return { lnAgg1, lnAgg2, lnResid, lnSigma, lnMu, cubes: lnCubes };
    }

    let lnLeftX = leftX - (T + 2) * cell - 3 * margin;

    let blockHalfMargin = 2 * margin;

    y += blockHalfMargin;

    let numColumns = 1;
    let blocksPerColumn = 12;
    if (shape.nBlocks > blocksPerColumn) {
        numColumns = Math.ceil(shape.nBlocks / blocksPerColumn);
    }
    let columnWidth = (C * 14) * cell + margin * 2;
    let blockIdxInColumn = 0;
    let blockYTop = y;

    let blocks = [];
    let blockSrc = residual0;


    y += blockHalfMargin;
    let ln_f = createLn(0, blockSrc, gptGpuModel?.ln_f);

    // cubes.push(...ln_f.cubes);

    let logitsTransposed = false;

    let lmHeadWeight: IBlkDef, logits: IBlkDef, logitsAgg1: IBlkDef, logitsAgg2: IBlkDef, logitsSoftmax: IBlkDef;

    if (logitsTransposed) {
        lmHeadWeight = mk({
            t: 'w', cx: vocabSize, cz: 1, cy: C, y: y,
            xR: lnLeftX, zM: 0,
            access: { src: gptGpuModel?.lm_head.weight, x: [0, 1, 0], y: [1, 0, 0], scale: 5.0 },
            dimX: DimStyle.n_vocab, dimY: DimStyle.C,
            name: 'LM Head Weights',
        });

        y += C * cell + margin;

        logits = mk({
            t: 'i', cx: vocabSize, cz: B, cy: T, y: y,
            xR: lnLeftX, zM: 0,
            access: { src: gptGpuModel?.lm_head.output, x: [1, 0, 0], y: [0, 1, T] },
            deps: { dot: [[lmHeadWeight, 'xi'], [ln_f.lnResid, 'yi']], dotLen: C },
            dimX: DimStyle.n_vocab, dimY: DimStyle.T,
            name: 'Logits',
        });

        // z += vocabSize * cell + margin;

        logitsAgg1 = mk({
            t: 'a', cx: 1, cz: B, cy: T, y: y,
            xL: lnLeftX + 1.5 * margin, zM: -3 * cell,
            access: { src: gptGpuModel?.softmaxFinal.agg, x: [1, 0, 0], y: [0, 1, T], channel: 'r' },
            deps: { add: [[logits, 'iy']], special: BlKDepSpecial.SoftmaxAggExp },
            dimX: DimStyle.None, dimY: DimStyle.T,
            name: 'SM Agg',
        });

        logitsAgg2 = mk({
            t: 'a', cx: 1, cz: B, cy: T, y: y,
            xL: lnLeftX + 1.5 * margin + cell, zM: -3 * cell,
            access: { src: gptGpuModel?.softmaxFinal.agg, x: [1, 0, 0], y: [0, 1, T], channel: 'g' },
            deps: { add: [[logits, 'iy']], special: BlKDepSpecial.SoftmaxAggMax },
            dimX: DimStyle.None, dimY: DimStyle.T,
            name: '',
        });

        y += T * cell + margin;

        logitsSoftmax = mk({
            t: 'i', cx: vocabSize, cz: B, cy: T, y: y,
            xR: lnLeftX, zM: 0,
            access: { src: gptGpuModel?.softmaxFinal.output, x: [1, 0, 0], y: [0, 1, T] },
            deps: { add: [[logits, 'xy'], [logitsAgg1, 'iy'], [logitsAgg2, 'iy']], special: BlKDepSpecial.Softmax },
            dimX: DimStyle.n_vocab, dimY: DimStyle.T,
            name: 'Logits Softmax',
        });

    } else {
        y += C * cell + margin;
        let leftX2 = leftX - T * cell - margin;

        lmHeadWeight = mk({
            t: 'w', cx: C, cy: vocabSize, cz: 1, y: y,
            xR: leftX2, zM: 0,
            access: { src: gptGpuModel?.lm_head.weight, x: [1, 0, 0], y: [0, 1, 0], scale: 5.0 },
            dimX: DimStyle.C, dimY: DimStyle.n_vocab,
            name: 'LM Head Weights',
        });


        logits = mk({
            t: 'i', cx: T, cy: vocabSize, cz: B, y: y,
            xR: leftX, zM: 0,
            access: { src: gptGpuModel?.lm_head.output, x: [0, 1, 0], y: [1, 0, T] },
            deps: { dot: [[lmHeadWeight, 'iy'], [ln_f.lnResid, 'xi']], dotLen: C },
            dimX: DimStyle.T, dimY: DimStyle.n_vocab,
            name: 'Logits',
        });

        y += vocabSize * cell + margin;

        logitsAgg2 = mk({
            t: 'a', cx: T, cy: 1, cz: B, y: y,
            xR: leftX, zM: 0,
            access: { src: gptGpuModel?.softmaxFinal.agg, x: [0, 1, 0], y: [1, 0, T], channel: 'g' },
            deps: { add: [[logits, 'xi']], special: BlKDepSpecial.SoftmaxAggMax },
            dimX: DimStyle.T, dimY: DimStyle.None,
            name: 'SM Agg',
        });

        logitsAgg1 = mk({
            t: 'a', cx: T, cy: 1, cz: B, y: y + cell,
            xR: leftX, zM: 0,
            access: { src: gptGpuModel?.softmaxFinal.agg, x: [0, 1, 0], y: [1, 0, T], channel: 'r' },
            deps: { add: [[logits, 'xi'], [logitsAgg2, 'x0']], special: BlKDepSpecial.SoftmaxAggExp },
            dimX: DimStyle.T, dimY: DimStyle.None,
            name: '',
        });

        y += 2 * cell + margin;

        logitsSoftmax = mk({
            t: 'i', cx: T, cy: vocabSize, cz: B, y: y,
            xR: leftX, zM: 0,
            access: { src: gptGpuModel?.softmaxFinal.output, x: [0, 1, 0], y: [1, 0, T] },
            deps: { add: [[logits, 'xy'], [logitsAgg1, 'xi'], [logitsAgg2, 'xi']], special: BlKDepSpecial.Softmax },
            dimX: DimStyle.T, dimY: DimStyle.n_vocab,
            name: 'Logits Softmax',
        });

    }

    // let logitsSoftmaxTopN = mk({
    //     t: 'i', cx: T, cz: B, cy: Math.min(32, vocabSize), y: y,
    //     xM: 0, zM: 0,
    // });

    let weightCount = vocabSize*C + T*C +
        nBlocks * ((2*C + 4*C*C + C + 3*C) + // self attn
                   (2*C + 4*C + 8*C*C + C)) + 2*C; // mlp

    // let decoderCount = vocabSize * C; (excluded from the weight count apparently)

    // cubes.push(lmHeadWeight, logits, logitsAgg1, logitsAgg2, logitsSoftmax);

    for (let i = 0; i < cubes.length; i++) {
        cubes[i].idx = i;
    }

    return {
        cubes,
        cell,
        margin,
        idxObj,
        tokEmbedObj,
        posEmbedObj,
        residual0,
        ln_f,
        lmHeadWeight,
        logits,
        logitsAgg1,
        logitsAgg2,
        logitsSoftmax,
        embedLabel,
        blocks,
        height: y,
        logitsTransposed,
        model: gptGpuModel,
        labels: [embedLabel, ...blocks.flatMap(b => b.labels)],
        weightCount,
        shape,
        extraSources: {
            idx: gptGpuModel?.inputBuf,
            tokEmbedOut: gptGpuModel?.vocabEmbed.output,
            posEmbedOut: gptGpuModel?.posEmbed.output,
        },
    };
}
