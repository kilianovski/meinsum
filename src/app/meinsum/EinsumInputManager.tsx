import React from 'react';
import OperandItem, {Operand} from './OperandItem'; // Import the child component

interface IEinsumEquation {
    operands: Operand[],
    equation: string
}

interface EinsumInputManagerProps {
    operands: Operand[],
    equation: string,
    onOperandsChange: (operands: Operand[]) => void,
    onEquationChange: (equation: string) => void,
    onAddOperand: () => void,
    onRemoveOperand: (index: number) => void,
    onUpdateOperand: (index: number, updatedOperand: Operand) => void
}

function EinsumInputManager({
    operands,
    equation,
    onOperandsChange,
    onEquationChange,
    onAddOperand,
    onRemoveOperand,
    onUpdateOperand
}: EinsumInputManagerProps) {

    const handleEquationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onEquationChange(event.target.value);
    };

    return (
        <div>
            {JSON.stringify(operands)}
            {operands.map((operand, index) => (
                <OperandItem
                    key={index}
                    operand={operand}
                    onUpdate={(updatedOperand) => onUpdateOperand(index, updatedOperand)}
                    onRemove={() => onRemoveOperand(index)}
                />
            ))}
            <button onClick={onAddOperand}>Add Operand</button>

            <div>
                <label>
                    Equation:
                    <input 
                        type="text" 
                        value={equation} 
                        onChange={handleEquationChange} 
                    />
                </label>
            </div>
        </div>
    );
}

export default EinsumInputManager;

