export function createPythonLoopString(
  operandNames: string[],
  inputDims: string[],
  summationDims: string[],
  freeDims: string[],
  dim2size: any): string {
  // summationDims and freeDims: lists of indices
  // dim2size: mapping from index to shape

  // *** EXAMPLE 1
  // INPUT:
  // operandNames = ['A', 'B', 'C', 'D']
  // inputDims = ['ia', 'jb', 'ab', 'ij']
  // summationDims = ['a', 'b']
  // freeDims = ['i', 'j']
  // dim2size = {'i': 8, 'j': 16, 'a': 42, 'b': 12}

  // OUTPUT:
  /*
      ```python
      R = zeros(shape=(8,16))
      for i in range(8):
          for j in range(16):
              total = 0
              for a in range(42):
                  for b in range(12):
                      total += A[i,a] * B[j,b] * C[a,b] * D[i,j]
              R[i,j] = total
      ```
  */

  // *** EXAMPLE 2
  // INPUT:
  // operandNames = ['A']
  // inputDims = ['i']
  // summationDims = ['i']
  // freeDims = []
  // dim2size = {'i': 8}

  // OUTPUT:
  /*
      ```python
      R = 0
      total = 0
      for i in range(8):
        total += A[i]
      R = total
      ```
  */

  // *** EXAMPLE 3
  // INPUT:
  // operandNames = ['A', 'B']
  // inputDims = ['i', 'j']
  // summationDims = ['j']
  // freeDims = ['i']
  // dim2size = {'i': 8, 'j': 16}

  // OUTPUT:
  /*
      ```python
      R = zeros(shape=(8,))
      for i in range(8):
        total = 0
        for j in range(16):
          total += A[i] * B[j]
        R[i] = total
      ```
  */

  // *** EXAMPLE 4
  // INPUT:
  // operandNames = ['A']
  // inputDims = ['i']
  // summationDims = ['']
  // freeDims = ['i']
  // dim2size = {'i': 8,}

  // OUTPUT:
  /*
      ```python
      R = zeros(shape=(8,))
      for i in range(8):
        total = 0
        total += A[i]
        R[i] = total
      ```
  */
  let pythonCode = '';
  let indent = '';
  if (freeDims.length === 0) {
    pythonCode += 'R = 0\n';
  } else {
    const shape = freeDims.map(dim => dim2size[dim]).join(', ');
    pythonCode += `R = zeros(shape=(${shape}))\n`;
  }

  indent = ''
  for (const dim of freeDims) {
    const size = dim2size[dim];
    pythonCode += `${indent}for ${dim} in range(${size}):\n`;
    indent += '    ';
  }

  pythonCode += indent + 'total = 0\n'

  // TODO: loop through summation indices:
  let summationIndent = indent;
  for (const dim of summationDims) {
    const size = dim2size[dim];
    pythonCode += `${summationIndent}for ${dim} in range(${size}):\n`;
    summationIndent += '    ';
  }

  function _indexedArray(name: string, dims: string | string[]) {
    if (typeof dims === 'string') {
      dims = dims.split('');
    }
    const dimString = dims.join(',');
    return `${name}[${dimString}]`
  }

  const operandsIndexed = [];

  for (let i = 0; i < inputDims.length; i++) {
    operandsIndexed.push(_indexedArray(operandNames[i], inputDims[i]))
  }
  let mulString = operandsIndexed.join(' * ');
  pythonCode += `${summationIndent}total += ${mulString}\n`


  const indexedR = freeDims.length > 0 ? _indexedArray('R', freeDims) : 'R'
  pythonCode += `${indent}${indexedR} = total`

  return pythonCode.trimEnd();
}



function runTests() {
  let testsPassed = 0;
  const testCases = [
    {
      args: {
        operandNames: ['A', 'B', 'C', 'D'],
        inputDims: ['ia', 'jb', 'ab', 'ij'],
        summationDims: ['a', 'b'],
        freeDims: ['i', 'j'],
        dim2size: { 'i': 8, 'j': 16, 'a': 42, 'b': 12 }
      },
      expected: `
R = zeros(shape=(8, 16))
for i in range(8):
    for j in range(16):
        total = 0
        for a in range(42):
            for b in range(12):
                total += A[i,a] * B[j,b] * C[a,b] * D[i,j]
        R[i,j] = total
`
    },
    {
      args: {
        operandNames: ['A'],
        inputDims: ['i'],
        summationDims: ['i'],
        freeDims: [],
        dim2size: { 'i': 8 }
      },
      expected: `
R = 0
total = 0
for i in range(8):
    total += A[i]
R = total
`
    },
    {
      args: {
        operandNames: ['A', 'B'],
        inputDims: ['i', 'j'],
        summationDims: ['j'],
        freeDims: ['i'],
        dim2size: { 'i': 8, 'j': 16 }
      },
      expected: `
R = zeros(shape=(8))
for i in range(8):
    total = 0
    for j in range(16):
        total += A[i] * B[j]
    R[i] = total
`
    },
    {
      args: {
        operandNames: ['A', 'B'],
        inputDims: ['Bi', 'Bj'],
        summationDims: [],
        freeDims: ['B', 'j', 'i'],
        dim2size: { 'B': 32, 'i': 8, 'j': 12 }
      },
      expected: `
R = zeros(shape=(32, 12, 8))
for B in range(32):
    for j in range(12):
        for i in range(8):
            total = 0
            total += A[B,i] * B[B,j]
            R[B,j,i] = total`
    },
    {
      args: {
        operandNames: ['A'],
        inputDims: ['i'],
        summationDims: [],
        freeDims: ['i'],
        dim2size: { 'i': 8 }
      },
      expected: `
R = zeros(shape=(8))
for i in range(8):
    total = 0
    total += A[i]
    R[i] = total`
    },
  ];

  for (let { args, expected } of testCases) {
    expected = expected.slice(1) // remove first newline
    const result = createPythonLoopString(args.operandNames, args.inputDims, args.summationDims, args.freeDims, args.dim2size);
    console.log(args)
    if (result.trimEnd() === expected.trimEnd()) {
      console.log('✅ Test passed');
      console.log('Expected:');
      console.log(expected)
      testsPassed++;
    } else {
      console.log('❌ Test failed');
      console.log('Expected:');
      console.log(expected)
      console.log('Received:');
      console.log(result)
    }
    console.log('******************************')
  }

  console.log(`Tests passed: ${testsPassed} / ${testCases.length}`);
}

runTests();








// console.log('*** EXAMPLE 1 ***');
// console.log(createPythonLoopString(['A', 'B', 'C', 'D'], ['i', 'j'], ['a', 'b'], ['i', 'j'], { 'i': 8, 'j': 16 }));

// console.log('*** EXAMPLE 2 ***');
// console.log(createPythonLoopString(['A'], ['i'], ['i'], [], { 'i': 8 }));

// console.log('*** EXAMPLE 3 ***');
// console.log(createPythonLoopString(
//   ['A', 'B'],
//   ['i', 'j'],
//   ['j'],
//   ['i'],
//   { 'i': 8, 'j': 16 }
// ));


// // function createPythonLoopString(
// //   operandNames: string[],
// //   inputDims: string[],
// //   summationDims: string[],
// //   freeDims: string[],
// //   dim2size: any)
// console.log('*** EXAMPLE 4 ***');
// console.log(createPythonLoopString(['A'], ['i'], [], ['i'], { 'i': 8 }));






