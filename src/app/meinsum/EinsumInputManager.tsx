import React from 'react';
import OperandItem, {IOperand} from './OperandItem'; // Import the child component

interface IEinsumEquation {
    operands: IOperand[],
    equation: string
}

interface EinsumInputManagerProps {
    operands: IOperand[],
    equation: string,
    onOperandsChange: (operands: IOperand[]) => void,
    onEquationChange: (equation: string) => void,
    onAddOperand: () => void,
    onRemoveOperand: (index: number) => void,
    onUpdateOperand: (index: number, updatedOperand: IOperand) => void
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
            {operands.map((operand, index) => (
                <OperandItem
                    key={index}
                    operand={operand}
                    onUpdate={(updatedOperand) => onUpdateOperand(index, updatedOperand)}
                    onRemove={() => onRemoveOperand(index)}
                />
            ))}

            <button onClick={onAddOperand} className="Commentary_btn__qpOgN  flex-[2] bg-blue-300 border border-blue-600 hover:bg-blue-400"  >
                <div>Add Operand</div>
            </button>

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

