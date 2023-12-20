import React from 'react';
import EinsumInputManager from './EinsumInputManager';
import { Operand, createOperand } from './OperandItem';
import { buildRelationMap } from '@/src/llm/meinsum';

export const EinsumDemoApp = () => {
    const [operands, setOperands] = React.useState<Operand[]>([
        createOperand('A', [8,8]),
        createOperand('B', [8,8]),
        createOperand('R', [8,8]),
    ]);
    const [equation, setEquation] = React.useState<string>('ik,jk->ij');

    const shapes = operands.map(op => op.shape)

    // try {

    // }
    const { relmap, freeDims, dim2size } = buildRelationMap(equation, ...shapes);
    console.log({ relmap, freeDims, dim2size })
    const displayString = `${freeDims} of shape ${relmap.shape}`
    
    const handleOperandsChange = (newOperands: Operand[]) => {
        setOperands(newOperands);
    };

    const handleEquationChange = (newEquation: string) => {
        setEquation(newEquation);
    };

    const handleAddOperand = () => {
        setOperands([...operands, { name: '', shape: [] }]);
    };

    const handleRemoveOperand = (index: number) => {
        const newOperands = operands.filter((_, i) => i !== index);
        setOperands(newOperands);
    };

    const handleUpdateOperand = (index: number, updatedOperand: Operand) => {
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

        <h1>{displayString}</h1>

        </>
    );
};

