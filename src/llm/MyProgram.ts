import { genModelViewMatrices, ICamera, ICameraPos, updateCamera } from "./Camera";
import { drawAllArrows } from "./components/Arrow";
import { drawBlockLabels, drawSectionLabel } from "./components/SectionLabels";
import { drawModelCard } from "./components/ModelCard";
import { IGptModelLink, IGpuGptModel, IModelShape } from "./GptModel";
import { genGptModelLayout, IBlkDef, IGptModelLayout } from "./GptModelLayout";
import { genEinsumLayout } from "./EinsumLayout";
import { drawText, IFontAtlasData, IFontOpts, measureText } from "./render/fontRender";
import { initRender, IRenderState, IRenderView, renderModel, resetRenderBuffers } from "./render/modelRender";
import { beginQueryAndGetPrevMs, endQuery } from "./render/queryManager";
import { SavedState } from "./SavedState";
import { isNotNil } from "@/src/utils/data";
import { Vec3, Vec4 } from "@/src/utils/vector";
import { initWalkthrough, runWalkthrough } from "./walkthrough/Walkthrough";
import { IColorMix } from "./Annotations";
import { Mat4f } from "@/src/utils/matrix";
import { runMouseHitTesting } from "./Interaction";
import { RenderPhase } from "./render/sharedRender";
import { drawBlockInfo } from "./components/BlockInfo";
import { NativeFunctions } from "./NativeBindings";
import { IWasmGptModel, stepWasmModel, syncWasmDataWithJsAndGpu } from "./GptModelWasm";
import { IMovementInfo, manageMovement } from "./components/MovementControls";
import { IBlockRender, initBlockRender } from "./render/blockRender";
import { ILayout } from "../utils/layout";
import { DimStyle } from "./walkthrough/WalkthroughTools";
import { Subscriptions } from "../utils/hooks";

import { IProgramState, IEinsumMenuItem } from "./Program";
import { createOperand, calculateOutput } from "../app/meinsum/EinsumDemoApp";
export interface IModelExample {
    name: string;
    shape: IModelShape;
    enabled: boolean;
    layout?: IGptModelLayout;
    blockRender: IBlockRender;
    offset: Vec3;
    modelCardOffset: Vec3;
    camera?: ICameraPos;
}

export interface IMouseState {
    mousePos: Vec3;
}

export interface IDisplayState {
    tokenColors: IColorMix | null;
    tokenIdxColors: IColorMix | null;
    tokenOutputColors: IColorMix | null;
    tokenIdxModelOpacity?: number[];
    topOutputOpacity?: number;
    lines: string[];
    hoverTarget: IHoverTarget | null;
    blkIdxHover: number[] | null;
    dimHover: DimStyle | null;
}

export interface IHoverTarget {
    subCube: IBlkDef;
    mainCube: IBlkDef;
    mainIdx: Vec3;
}



function addOutput(mi: IEinsumMenuItem): IEinsumMenuItem {
    return { ...mi, state: { ...mi.state, output: calculateOutput(mi.state) } }
}

const nHeads = 4;
const hiddenSize = 8;
const nQueries = 4;
const nKeys = 12;
const batch_size = 8;

const menuItems = [
    {
        name: "Multihead Query-Key Attention scores (similarity between each query and each key)",
        state: {
            equation: 'Bnqh,Bnkh->Bnqk',
            operands: [
                createOperand('Q', [batch_size, nHeads, nQueries, hiddenSize]),
                createOperand('K', [batch_size, nHeads, nKeys, hiddenSize]),
            ]
        },
    },

    {
        name: "Quadratic form",
        state: {
            equation: 'a,ab,b->',
            operands: [createOperand('x', [7]), createOperand('Symmetric Q', [7, 7]), createOperand('x', [7])]
        },
    },

    {
        name: "Dot product",
        state: {
            equation: 'i,i->',
            operands: [createOperand('A', [16]), createOperand('B', [16])]
        },
    },

    {
        name: "Outer product transposed",
        state: {
            equation: 'i,j->ji',
            operands: [createOperand('A', [7]), createOperand('B', [22])]
        },
    },


    {
        name: "Matrix Multiplication",
        state: {
            equation: 'ik,kj->ij',
            operands: [createOperand('A', [16, 8]), createOperand('B', [8, 12])]
        }
    },

    {
        name: "Return a diagonal",
        state: {
            equation: 'ii->i',
            operands: [createOperand('A', [16, 16])]
        },
    },

    {
        name: "Batched Matrix Multiplication",
        state: {
            equation: 'Bik,Bkj->Bij',
            operands: [createOperand('A', [32, 16, 8]), createOperand('B', [32, 8, 12])]
        }
    },
    {
        name: "Custom",
        state: {
            equation: 'abcdefg,h->he',
            operands: [createOperand('A', [2, 2, 2, 2, 2, 3, 3]), createOperand('B', [8])]
        }
    },
];

export function initProgramState(canvasEl: HTMLCanvasElement, fontAtlasData: IFontAtlasData): IProgramState {

    let render = initRender(canvasEl, fontAtlasData);
    let walkthrough = initWalkthrough();

    let prevState = SavedState.state;
    let camera: ICamera = {
        angle: prevState?.camera.angle ?? new Vec3(296, 16, 13.5),
        center: prevState?.camera.center ?? new Vec3(-8.4, 0, -481.5),
        transition: {},
        modelMtx: new Mat4f(),
        viewMtx: new Mat4f(),
        lookAtMtx: new Mat4f(),
        camPos: new Vec3(),
        camPosModel: new Vec3(),
    }

    let shape: IModelShape = {
        B: 1,
        T: 11,
        C: 48,
        nHeads: 3,
        A: 48 / 3,
        nBlocks: 3,
        vocabSize: 3,
    };

    let gpt2ShapeSmall: IModelShape = {
        B: 1,
        T: 1024,
        C: 768,
        nHeads: 12,
        A: 768 / 12,
        nBlocks: 12,
        vocabSize: 50257,
    };

    let gpt2ShapeLarge: IModelShape = {
        B: 1,
        T: 1024,
        C: 1600,
        nHeads: 25,
        A: 1600 / 25,
        nBlocks: 48,
        vocabSize: 50257,
    };

    let gpt3Shape: IModelShape = {
        B: 1,
        T: 1024,
        C: 12288,
        nHeads: 96,
        A: 12288 / 96,
        nBlocks: 96,
        vocabSize: 50257,
    };

    function makeCamera(center: Vec3, angle: Vec3): ICameraPos {
        return { center, angle };
    }

    let delta = new Vec3(10000, 0, 0);

    const einsumProgramState: IEinsumProgramState = {
        equation: 'i,j->i',
        operands: [createOperand('A', [8]), createOperand('B', [7])],
        output: createOperand('Q', [2, 2, 2])
    };
    return {
        einsumStates: menuItems,
        currentEinsumState: 0,
        // currentEinsumState: menuItems.length - 1,
        native: null,
        wasmGptModel: null,
        render: render!,
        inWalkthrough: true,
        walkthrough,
        camera,
        shape: shape,
        layout: genEinsumLayout(shape),
        currExampleId: -1,
        mainExample: {
            name: 'nano-gpt',
            enabled: true,
            shape: shape,
            offset: new Vec3(),
            modelCardOffset: new Vec3(),
            blockRender: null!,
            camera: makeCamera(new Vec3(42.771, 0.000, -569.287), new Vec3(284.959, 26.501, 12.867)),
        },
        examples: [{
            name: 'GPT-2 (small)',
            enabled: true,
            shape: gpt2ShapeSmall,
            offset: delta.mul(-5),
            modelCardOffset: delta.mul(-2.0),
            blockRender: initBlockRender(render?.ctx ?? null),
            camera: makeCamera(new Vec3(-65141.321, 0.000, -69843.439), new Vec3(224.459, 24.501, 1574.240)),
        }, {
            name: 'GPT-2 (XL)',
            enabled: true,
            shape: gpt2ShapeLarge,
            offset: delta.mul(20),
            modelCardOffset: delta.mul(0.5),
            blockRender: initBlockRender(render?.ctx ?? null),
            camera: makeCamera(new Vec3(237902.688, 0.000, -47282.484), new Vec3(311.959, 23.501, 1382.449)),
        }, {
            name: 'GPT-3',
            enabled: false,
            shape: gpt3Shape,
            offset: delta.mul(50.0),
            modelCardOffset: delta.mul(15.0),
            blockRender: initBlockRender(render?.ctx ?? null),
            camera: makeCamera(new Vec3(837678.163, 0.000, -485242.286), new Vec3(238.959, 10.501, 12583.939)),
        }],
        gptGpuModel: null,
        jsGptModel: null,
        stepModel: false,
        markDirty: () => { },
        htmlSubs: new Subscriptions(),
        mouse: {
            mousePos: new Vec3(),
        },
        movement: {
            action: null,
            actionHover: null,
            target: [0, 0],
            depth: 1,
            cameraLerp: null,
        },
        display: {
            tokenColors: null,
            tokenIdxColors: null,
            tokenOutputColors: null,
            lines: [],
            hoverTarget: null,
            dimHover: null,
            blkIdxHover: null,
        },
        pageLayout: {
            height: 0,
            width: 0,
            isDesktop: true,
            isPhone: true,
        }
    };
}

export function initCamera(state: IProgramState) {
    const cubes = state.layout.cubes;

    let obj = cubes[cubes.length - 1];
    // console.log(cubes)
    let modelTarget = new Vec3(obj.x, obj.y, obj.z);
    let modelMtx = state.camera.modelMtx.mul(Mat4f.fromTranslation(state.mainExample.offset))

    let center = modelMtx.mulVec3Proj(modelTarget);

    let zoom = 0.7;
    // state.camera.desiredCamera = {
    //     center, angle: new Vec3(270, 4.5, zoom),
    // }

    state.camera.center = center;
    // state.camera.center = new Vec3(-8.25, 0.75, -13.5)
    state.camera.angle = new Vec3(270, 4.5, 0.8);
}

export function runEinsumProgram(view: IRenderView, state: IProgramState) {
    // console.log('Banana program!')
    let timer0 = performance.now();

    if (!state.render) {
        return;
    }

    resetRenderBuffers(state.render);
    state.render.sharedRender.activePhase = RenderPhase.Opaque;
    state.display.lines = [];
    state.display.hoverTarget = null;
    state.display.tokenColors = null;
    state.display.tokenIdxColors = null;

    if (state.wasmGptModel && state.jsGptModel) {
        syncWasmDataWithJsAndGpu(state.wasmGptModel, state.jsGptModel);
    }

    if (state.stepModel && state.wasmGptModel && state.jsGptModel) {
        state.stepModel = false;
        stepWasmModel(state.wasmGptModel, state.jsGptModel);
    }

    // generate the base model, incorporating the gpu-side model if available
    state.layout = genEinsumLayout(state);


    // @TODO: handle different models in the same scene.
    // Maybe need to copy a lot of different things like the entire render state per model?
    // for (let example of state.examples) {
    //     if (example.enabled && !example.layout) {
    //         let layout = genGptModelLayout(example.shape, null, example.offset);
    //         example.layout = layout;
    //     }
    // }

    genModelViewMatrices(state, state.layout!);


    // will modify layout; view; render a few things.
    // if (state.inWalkthrough) {
    //     runWalkthrough(state, view);
    // }


    updateCamera(state, view);
    let queryRes = beginQueryAndGetPrevMs(state.render.queryManager, 'render');
    if (isNotNil(queryRes)) {
        state.render.lastGpuMs = queryRes;
    }

    state.render.renderTiming = false; // state.pageLayout.isDesktop;


    drawBlockInfo(state);
    // // these will get modified by the walkthrough (stored where?)
    // drawAllArrows(state.render, state.layout);

    // drawModelCard(state, state.layout, 'nano-gpt', new Vec3());
    // drawTokens(state.render, state.layout, state.display);

    // for (let example of state.examples) {
    //     if (example.enabled && example.layout) {
    //         drawModelCard(state, example.layout, example.name, example.offset.add(example.modelCardOffset));
    //     }
    // }

    // manageMovement(state, view);
    runMouseHitTesting(state);
    state.render.sharedRender.activePhase = RenderPhase.Opaque;
    // drawBlockLabels(state.render, state.layout);
    let baseColor = new Vec4(0.4, 0.4, 0.4, 1.0);

    // {
    //     const layout = state.layout;
    //     // const st

    //     const x = -10;
    //     const y = 10;
    //     const dy = 5;

    //     let color = baseColor.mul(layout.embedLabel.visible);
    //     let tl = new Vec3(x - layout.margin * 2, y, 0);
    //     let br = new Vec3(x - layout.margin * 2, y + dy, 0);
    //     drawSectionLabel(state.render, "Embedding", tl, br, { color, fontSize: 6, pad: 4 });
    // }

    let lineNo = 1;
    let tw = state.render.size.x;
    state.render.sharedRender.activePhase = RenderPhase.Overlay2D;
    for (let line of state.display.lines) {
        let opts: IFontOpts = { color: new Vec4(), size: 14 };
        let w = measureText(state.render.modelFontBuf, line, opts);
        drawText(state.render.modelFontBuf, line, tw - w - 4, lineNo * opts.size * 1.3 + 4, opts)
        lineNo++;
    }

    // render everything; i.e. here's where we actually do gl draw calls
    // up until now, we've just been putting data in cpu-side buffers
    renderModel(state);

    endQuery(state.render.queryManager, 'render');
    state.render.gl.flush();

    state.render.lastJsMs = performance.now() - timer0;
}
