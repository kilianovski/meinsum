import React, { useState } from 'react';


function parseShape(shapeStr) {
    // Remove spaces and parentheses
    shapeStr = shapeStr.replace(/\s|\(|\)/g, "");
  
    // Return null if the string is empty
    if (!shapeStr) return null;
  
    // Split the string by commas
    const parts = shapeStr.split(',');
  
    // Validate each part and convert to an integer
    const numbers = [];
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

  
//   // Run the tests again with the implemented function
//   testShapeParsing();
const initialShapeString = '8,16';
  
export const ShapeEditor = ({onShapesUpdated}) => {

    // if (!onShapesUpdated) onShapesUpdated = () => {};
    const [shapes, setShapes] = useState([
        { name: 'A', shape: initialShapeString, list: parseShape(initialShapeString)},
        // Add default shapes here
    ]);

    onShapesUpdated(shapes);

    const addShape = () => {
        const newShape = { name: 'Q', shape: initialShapeString, list: parseShape(initialShapeString) };
        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        onShapesUpdated(newShapes)
    };


    const isShapeValid = (shapeString) => {
        return /^(\d+,)*\d+$/.test(shapeString);
      };


    const isPyTorchShapeValid = (shape) => {
        const parts = shape.split(',').map(part => part.trim());
        return parts.every(part => /^\d+$/.test(part) && part !== '');
      };

      const updateShape = (index, key, value) => {
        const updatedShapes = shapes.map((shape, i) => {
          if (i === index) {
            const updatedShape = { ...shape, [key]: value };
            if (key === 'shape') {
              updatedShape.list = parseShape(value);
            }
            return updatedShape;
          }
          return shape;
        });
        setShapes(updatedShapes);
        onShapesUpdated(shapes);
      };
    // const updateShape = (index, key, value) => {
    //     const updatedShapes = shapes.map((shape, i) => {
    //       if (i === index) {
    //         return { ...shape, [key]: value };
    //       }
    //       if (key === 'shape') {
    //         updatedShape.list = parseShape(value);
    //         console.log('updatedShape.list = parseShape(value);', updatedShape)
    //       }
    //       return shape;
    //     });
    //     setShapes(updatedShapes);
    //   };

    return (
        <div>
        {
            shapes.map((shape, index) => (
                <div key= { index } >
                <input
            type="text"
            value = { shape.name }
            onChange={(e) => updateShape(index, 'name', e.target.value)}
            />
    <input
type = "text"
value = { shape.shape }
style={{ color: shape.list !== null ? 'black' : 'red' }}
onChange={(e) => updateShape(index, 'shape', e.target.value)}
/>
    </div>
      ))}
<button onClick={ addShape }> +</button>
    </div>
  );
};


