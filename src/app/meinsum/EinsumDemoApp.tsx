import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import EinsumInputManager from './EinsumInputManager';
import { IOperand, createOperand } from './OperandItem';
import { buildRelationMap, MultidimArray } from '@/src/llm/meinsum';
import {createPythonLoopString} from './MeinsumStringification';

export const EinsumDemoApp = () => {
    const [operands, setOperands] = React.useState<IOperand[]>([
        createOperand('A', [8,8]),
        createOperand('B', [8,8]),
        // createOperand('R', [8,8]),
    ]);
    const [equation, setEquation] = React.useState<string>('ik,jk->ij');

    const shapes = operands.map(op => op.shape)

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

    // try {

    // }
    const { relmap, freeDims, dim2size, summationDims, inputDims } = buildRelationMap(equation, ...shapes);
    // function createPythonLoopString(
    //     operandNames: string[],
    //     inputDims: string[],
    //     summationDims: string[],
    //     freeDims: string[],
    //     dim2size: any)
    const operandNames = operands.map(op => op.name);
    const displayPythonString = createPythonLoopString(
        operandNames,
        inputDims,
        summationDims,
        freeDims,
        dim2size
    );
    
    const handleOperandsChange = (newOperands: IOperand[]) => {
        setOperands(newOperands);
    };

    const handleEquationChange = (newEquation: string) => {
        setEquation(newEquation);
    };

    const handleAddOperand = () => {
        setOperands([...operands, createNewOperand()]);
    };

    const handleRemoveOperand = (index: number) => {
        const newOperands = operands.filter((_, i) => i !== index);
        setOperands(newOperands);
    };

    const handleUpdateOperand = (index: number, updatedOperand: IOperand) => {
        const newOperands = operands.map((operand, i) =>
            i === index ? updatedOperand : operand
        );
        setOperands(newOperands);
    };

    return (

        <>
                <EinsumInputManager
            operands={operands}
            equation={equation}
            onOperandsChange={handleOperandsChange}
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

