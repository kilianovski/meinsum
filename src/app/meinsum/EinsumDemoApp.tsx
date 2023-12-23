import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import EinsumInputManager from './EinsumInputManager';
import { IOperand, createOperand } from './OperandItem';
import { buildRelationMap, MultidimArray } from '@/src/llm/meinsum';
import {createPythonLoopString} from './MeinsumStringification';

export {createOperand};
export interface IOutput extends IOperand {
    relmap: MultidimArray
}


function tryCreateRelmap(einsumProgramState: IEinsumProgramState) {
    const {equation, operands} = einsumProgramState;
    const shapes = operands.map(op => op.shape)



    let relmap;
    let displayPythonString = '';
    try {
        const relmapOutput = buildRelationMap(equation, ...shapes);
        if (!relmapOutput.valid) {
            displayPythonString = `raise ValueError("${relmapOutput.reason}")`;
        } else {
            const { freeDims, dim2size, summationDims, inputDims } = relmapOutput;
            relmap = relmapOutput.relmap;
            // function createPythonLoopString(
            //     operandNames: string[],
            //     inputDims: string[],
            //     summationDims: string[],
            //     freeDims: string[],
            //     dim2size: any)
            const operandNames = operands.map(op => op.name);
            displayPythonString = createPythonLoopString(
                operandNames,
                inputDims,
                summationDims,
                freeDims,
                dim2size
            );
        }
    } catch (exception) {
        displayPythonString = ''+exception
    }

    return {relmap, displayPythonString}
}
export interface IEinsumProgramState {
    equation: string,
    output: IOutput | undefined,
    operands: IOperand[]
}

export interface IEinsumDemoAppProps {
    einsumProgramState: IEinsumProgramState,
    onStateChanged: (newState: IEinsumProgramState) => void
}

export function calculateOutput(state: IEinsumProgramState) {
    const {relmap, displayPythonString} = tryCreateRelmap(state);
    let output;
    if (relmap) {
        output = createOperand('Result', relmap.shape);
        output.relmap = relmap;
    }
    return output;
}

export const EinsumDemoApp = ({einsumProgramState, onStateChanged}: IEinsumDemoAppProps) => {
    const {equation, output, operands} = einsumProgramState;

    const {relmap, displayPythonString} = tryCreateRelmap(einsumProgramState);
    const isEquationValid = Boolean(relmap);

    function createNewOperand(){
        const defaultShape = [8, 32];
        let newName = 'Q'; // Fallback name
        if (operands.length > 0) {
            const lastOperandName = operands[operands.length - 1].name;
            if (lastOperandName.length === 1) {
                const lastCharCode = lastOperandName.charCodeAt(0);
                newName = String.fromCharCode(lastCharCode + 1);
            }
        }
        return createOperand(newName, defaultShape);
    }

    function _onWithOutput(newState: IEinsumProgramState) {
        newState.output = calculateOutput(newState);
        onStateChanged(newState);
    }

    if (!output) {
       let output = calculateOutput(einsumProgramState)
       if (output) {
       } else {
        output = createOperand('ERROR', [1,1,1,1]);
       }
       onStateChanged({...einsumProgramState, output})
    }

    const handleEquationChange = (equation: string) => {
        _onWithOutput({...einsumProgramState, equation});
    };

    const handleAddOperand = () => {
        const newOperands = [...operands, createNewOperand()]
        _onWithOutput({...einsumProgramState, operands: newOperands})
    };

    const handleRemoveOperand = (index: number) => {
        const newOperands = operands.slice(0, index).concat(operands.slice(index+1));
        _onWithOutput({...einsumProgramState, operands: newOperands})
    };

    const handleUpdateOperand = (index: number, updatedOperand: IOperand) => {
        const newOperands = [...operands.slice(0, index), updatedOperand, ...(operands.slice(index+1))]
        _onWithOutput({...einsumProgramState, operands: newOperands})
    };

    return (

        <>
                <EinsumInputManager
            operands={operands}
            equation={equation}
            isEquationValid={isEquationValid}
            onEquationChange={handleEquationChange}
            onAddOperand={handleAddOperand}
            onRemoveOperand={handleRemoveOperand}
            onUpdateOperand={handleUpdateOperand}
        />

<SyntaxHighlighter language="python">
      {displayPythonString}
    </SyntaxHighlighter>

        </>
    );
};

