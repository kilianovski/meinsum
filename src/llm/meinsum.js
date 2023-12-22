// class MultidimArray {
export class MultidimArray {
    constructor(shape) {
      this.shape = shape;
      this.array = this.initArray(shape);
    }

    static fromArray(array) {
      function checkShape(arr, shape = []) {
        if (!Array.isArray(arr)) return shape;
        const len = arr.length;
        shape.push(len);
        for (let i = 0; i < len; i++) {
          if (Array.isArray(arr[i])) {
            const innerShape = checkShape(arr[i]);
            if (shape.length > 1 && innerShape.length + shape.length - 1 !== shape.length) {
              throw new Error('Non-uniform shape detected');
            }
            if (innerShape.length > 0) {
              shape.push(...innerShape);
              break;
            }
          }
        }
        return shape;
      }
      const shape = checkShape(array);
      const multidimArray = new MultidimArray(shape);
      multidimArray.array = array;
      return multidimArray;
    }
  
    initArray(shape) {
      if (shape.length === 0) return [];
      return Array.from({ length: shape[0] }, () => this.initArray(shape.slice(1)));
    }
  
    getItem(indices) {
      return indices.reduce((arr, index) => arr[index], this.array);
    }
  
    setItem(indices, value) {
      indices.reduce((arr, index, idx) => {
        if (idx === indices.length - 1) {
          arr[index] = value;
          return value;
        }
        return arr[index];
      }, this.array);
    }
  
    toString() {
      return JSON.stringify(this.array);
    }
  }
  
  function iterate(dims, dim2size) {
    function _iterate(sizeTuple) {
      if (sizeTuple.length === 0) return [[]];
      const smallerIters = _iterate(sizeTuple.slice(1));
      return [].concat(...Array.from({ length: sizeTuple[0] }, (_, i) => smallerIters.map(coords => [i].concat(coords))));
    }
    const sizeTuple = dims.map(d => dim2size[d]);
    return _iterate(sizeTuple);
  }
  
  function deindex(dims, idx, dimNames) {
    const globalCoords = Object.fromEntries(dimNames.map((name, i) => [name, idx[i]]));
    return dims.map(name => globalCoords[name]);
  }



export function buildRelationMap(equation, ...shapes) {
// function buildRelationMap(equation, ...shapes) {
  // Check if the equation is a string
    if (typeof equation !== 'string') {
      return { valid: false, reason: 'Equation must be a string.' };
    }

    if (!Array.isArray(shapes)) {
      return { valid: false, reason: 'Shapes should be an array' };
    }

    if (!equation.includes('->')) {
      equation += '->';
    }

  
    const [inputs, outputs] = equation.split('->');
    const inputDims = inputs.split(',');
    const outputDims = outputs.split(',');
    const outputDim = outputDims[0];
   // Check if the number of input dimensions matches the number of provided shapes
   if (inputDims.length !== shapes.length) {
    return { valid: false, reason: 'Number of input dimensions does not match the number of provided shapes.' };
  }

  // Check if each input shape matches its corresponding subscript
  for (let i = 0; i < shapes.length; i++) {
    if (inputDims[i].length !== shapes[i].length) {
      return { valid: false, reason: `Shape at index ${i} does not match its corresponding subscript.` };
    }
  }

  // Check for repeated subscripts in the output
  const uniqueOutputDims = [...new Set(outputDims.join(''))];
  if (uniqueOutputDims.length !== outputDims.join('').length) {
    return { valid: false, reason: 'Repeated subscripts in the output are not allowed.' };
  }

  // Check if all output subscripts appear in the input
  for (let i = 0; i < uniqueOutputDims.length; i++) {

        const dim = uniqueOutputDims[i]
        
        let includes = false;

        for (let inputD of inputDims) {
          if (inputD.includes(dim)){
            includes = true;
          }
        }
        if (!includes) {
          return { valid: false, reason: `Output subscript '${dim}' does not appear in the input.` };
        }

    }
    const dim2size = {};
  
    inputDims.forEach((dims, i) => {
      dims.split('').forEach((dim, j) => {
        dim2size[dim] = shapes[i][j];
      });
    });

    const dimsOfEachOp = {};

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      for (let j = 0; j < shape.length; j++) {
        const dim = inputDims[i][j];
        const info = {opi: i, size: shape[j]};
        if (dim in dimsOfEachOp){
          dimsOfEachOp[dim].push(info)
        } else{
          dimsOfEachOp[dim] = [info]
        }
      }
    }


    for (const dim in dimsOfEachOp) {
      const opsInfo = dimsOfEachOp[dim];
      const trueSize = opsInfo[0].size;

      for (let i = 0; i < opsInfo.length; i++) {
        const opInfo = opsInfo[i];
        if (opInfo.size != trueSize) {
          return { 
            valid: false, 
            reason: `Dimension '${dim}' has mismatched sizes across operands. operands[0].shape=${trueSize} while operands[${opInfo.opi}].shape=${opInfo.size}` };
        }
      }

    }
  
    const freeDims = outputDim.split('');
    const summationDims = [...new Set([].concat(...inputDims.map(dim => dim.split(''))))].filter(d => !freeDims.includes(d));
  
    const outputShape = freeDims.map(d => dim2size[d]);
  
    const isScalar = outputShape.length === 0;
    let relmap = isScalar ? 0 : new MultidimArray(outputShape);
  
    const dimNames = freeDims.concat(summationDims);
  
    iterate(freeDims, dim2size).forEach(freeIdx => {
      const sumCoords = [];
  
      iterate(summationDims, dim2size).forEach(summationIdx => {
        const idx = freeIdx.concat(summationIdx);
        const mulCoords = inputDims.map((dims, oi) => {
          const localIdx = deindex(dims.split(''), idx, dimNames);
          return { operand_i: oi, local_idx: localIdx };
        });
        sumCoords.push(mulCoords);
      });
  
      if (isScalar) {

        relmap = new MultidimArray([1]);
        relmap.shape = [];
        relmap.array = sumCoords;
      } else {
        relmap.setItem(freeIdx, sumCoords);
      }
    });
  
    return { valid: true, relmap, freeDims, dim2size, summationDims, inputDims };
  }
  
  function sumRelmap(relmap, freeDims, dim2size, ...operands) {
    const isScalar = freeDims.length === 0;
    let R = isScalar ? 0 : new MultidimArray(relmap.shape);
  
    iterate(freeDims, dim2size).forEach(freeIdx => {
      const sumCoords = isScalar ? relmap.array : relmap.getItem(freeIdx);
      let s = 0;
  
      sumCoords.forEach(sumIdx => {
        let m = 1;
        sumIdx.forEach(({ operand_i, local_idx }) => {
          m *= operands[operand_i].getItem(local_idx);
        });
        s += m;
      });
  
      if (isScalar) {
        R = s;
      } else {
        R.setItem(freeIdx, s);
      }
    });
  
    return R;
  }
  
  function allDtypeEquals(operands) {
    const dtype = operands[0].dtype;
    return operands.every(o => o.dtype === dtype);
  }
  
  function myEinsum(equation, ...operands) {
    operands = operands.map(op => op instanceof MultidimArray ? op : MultidimArray.fromArray(op));
    const shapes = operands.map(o => o.shape);
    const output = buildRelationMap(equation, ...shapes);
    if (!output.valid) {
      throw new Error(output);
    }

    const { relmap, freeDims, dim2size } = output;
    let R = sumRelmap(relmap, freeDims, dim2size, ...operands);
    return R;
  }
  
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

// Example usage:
  function assertArraysEqual(a, b) {
    if (a instanceof MultidimArray) a = a.array;
    if (b instanceof MultidimArray) b = b.array;
    function isArrayEqual(a, b) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (Array.isArray(a[i]) && Array.isArray(b[i])) {
          if (!isArrayEqual(a[i], b[i])) return false;
        } else if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }
    if (!isArrayEqual(a, b)) {
      throw new Error('Arrays are not equal');
    }
  }



myEinsum('ij,kj->ij', [[1, 2, 3]], [[1,2,3], [1,2,3]]);


const result1 = myEinsum('i->', [1, 2, 3]);
assert(result1 == 6)

const result2 = myEinsum('i,i->', [1, 2], [3, 4]);
assert(result2 == 11)

let result
result = myEinsum('i,i->i', [1, 2], [3, 4]);
assertArraysEqual(result, [3, 8])


result = myEinsum('i,j->i', [1, 2], [3, 4]);
assertArraysEqual(result, [7, 14])


