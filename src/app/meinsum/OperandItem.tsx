import React from 'react';

type Operand = {
    name: string;
    shape: number[] | null;
    shapeString: string;
}

export function createOperand(name: string, shape:number[] ) : Operand{
    return {name, shape, shapeString: JSON.stringify(shape)}
}

function tryParseShape(shapeStr: string): number[] | null {
    // Remove spaces and parentheses
    shapeStr = shapeStr.replace(/\s|\(|\)/g, "");

    // Return null if the string is empty
    if (!shapeStr) return null;

    // Split the string by commas
    const parts = shapeStr.split(',');

    // Validate each part and convert to an integer
    const numbers: number[] = [];
    for (const part of parts) {
        if (/^-?\d+$/.test(part)) {
            numbers.push(parseInt(part, 10));
        } else {
            // If any part is not a valid integer, return null
            return null;
        }
    }

    return numbers;
}


interface OperandItemProps {
    operand: Operand;
    onUpdate: (operand: Operand) => void;
    onRemove: () => void;
}

const OperandItem: React.FC<OperandItemProps> = ({ operand, onUpdate, onRemove }) => {
    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...operand, name: event.target.value });
    };

    const handleShapeStringChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const shapeString = event.target.value;
        const parsedShape = tryParseShape(shapeString);
        onUpdate({ ...operand, shape: parsedShape, shapeString });
    };

    const shapeInputStyle = operand.shape !== null
        ? {}
        : { color: 'red', borderWidth: '2px' };

    return (
        <div>
        <input
            type= "text"
    value = { operand.name }
    onChange = { handleNameChange }
    placeholder = "Name"
        />
        <input
                type="text"
    value = { operand.shapeString }
    onChange = { handleShapeStringChange }
    placeholder = "Shape (e.g., 2,3)"
    style = { shapeInputStyle }
        />
        <button onClick={ onRemove }> Remove </button>
            </div>
    );
}

export default OperandItem;
