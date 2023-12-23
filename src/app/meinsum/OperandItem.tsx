import React, { useState } from 'react';
import clsx from 'clsx';

export interface IOperand {
    name: string,
    shapeString: string
    isShapeStringValid: boolean
    shape: number[]
}

export function createOperand(name: string, shape:number[] ) : IOperand{
    return {name, shape, shapeString: JSON.stringify(shape), isShapeStringValid: true}
}

function tryParseShape(shapeStr: string): number[] | null {
    // Remove spaces and parentheses
    shapeStr = shapeStr.replace(/\s|\(|\)|\[|\]/g, "");

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
    operand: IOperand;
    onUpdate: (operand: IOperand) => void;
    onRemove: () => void;
}

const OperandItem: React.FC<OperandItemProps> = ({ operand, onUpdate, onRemove }) => {
    const [ text, setText ] = useState(operand.shapeString);

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...operand, name: event.target.value });
    };

    const handleShapeStringChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const shapeString = event.target.value;
        setText(shapeString);

        const parsedShape = tryParseShape(shapeString);
        const isShapeStringValid = Boolean(parsedShape);
        const newShape = isShapeStringValid ? parsedShape : operand.shape;
        onUpdate({...operand, shape: newShape, shapeString, isShapeStringValid});
    };

    const shapeInputStyle = operand.isShapeStringValid
        ? {}
        : { color: 'red', borderWidth: '2px' };
        const inputStyle = {
            border: '1px solid #007bff', // A blue border
            borderRadius: '2px',         // Rounded corners
            padding: '4px 4px',         // Padding inside the input
            margin: '1px 4px',             // Margin around the input
            outline: 'none',             // Remove the default focus outline
            boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.1)', // Inner shadow for depth
            width: '100px', // Set width to 50% of the parent element's width

            fontSize: '0.8rem',          // Smaller font size
            transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out' // Smooth transition for focus
        };
    return (
        <div>
        <input
            type= "text"
    value = { operand.name }
    onChange = { handleNameChange }
    placeholder = "Name"
    style={inputStyle}
        />
        <input
                type="text"
        className=''
    value = { text }
    onChange = { handleShapeStringChange }
    placeholder = "Shape (e.g., 2,3)"
    style={{ ...inputStyle, ...shapeInputStyle }}
    />
        <button onClick={ onRemove }>❌ </button>
        </div>
    );
}

export default OperandItem;
