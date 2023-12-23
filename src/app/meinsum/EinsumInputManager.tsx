import React, {useState} from 'react';
import OperandItem, {IOperand} from './OperandItem'; // Import the child component

interface IEinsumEquation {
    operands: IOperand[],
    equation: string
}

interface EinsumInputManagerProps {
    operands: IOperand[],
    equation: string,
    isEquationValid: boolean | undefined,
    onEquationChange: (equation: string) => void,
    onAddOperand: () => void,
    onRemoveOperand: (index: number) => void,
    onUpdateOperand: (index: number, updatedOperand: IOperand) => void
}

function EinsumInputManager({
    operands,
    equation,
    isEquationValid,
    onEquationChange,
    onAddOperand,
    onRemoveOperand,
    onUpdateOperand
}: EinsumInputManagerProps) {
    const [ equationText, setEquationText ] = useState(equation);

    const handleEquationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newEquation = event.target.value;
        setEquationText(newEquation);
        onEquationChange(newEquation);
    };
    const equationInputStyle = isEquationValid
        ? {}
        : { color: 'red', borderWidth: '2px' };
    
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
                        style={equationInputStyle} 
                        onChange={handleEquationChange} 
                    />
                </label>
            </div>
        </div>
    );
}

export default EinsumInputManager;

