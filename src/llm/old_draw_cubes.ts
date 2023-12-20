for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    let deps = null;
    if (i == shapes.length - 1) {
        const last_cube = cubes[cubes.length - 1]
        const first_cube = cubes[0]

        deps = { add: [[last_cube, 'xi'], [first_cube, 'ix']] };
    };

    if (s.length > 2) {
        const dim1 = s[s.length - 1];
        const dim2 = s[s.length - 2];
        const dim3 = s[s.length - 3];
        let zF = 0;

        for (let m = s.length - 4; m >= 0; m--) {
            const dimM = s[m];

            for (let q = 0; q < dimM; q++) {
                // 3rd dimension
                for (let k = 0; k < dim3; k++) {
                    let m = mk({
                        t: 'w',
                        xL: xL, zF: zF, y: y,
                        cx: dim1, cz: 1, cy: dim2,
                        deps: deps,
                        access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
                        dimX: DimStyle.n_vocab, dimY: DimStyle.C,
                        name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
                    });
                    zF -= (dim3 * dim3_cell + dim3_margin)
                    cubes.push(m);
                }
                zF -= (10 * dim3 * dim3_cell + dim3_margin)
            }

        }


        dim3_label: {

        }

        if (s.length == 3) {
            // 3rd dimension
            let zF = 0;
            for (let k = 0; k < dim3; k++) {
                let m = mk({
                    t: 'w',
                    xL: xL, zF: zF, y: y,
                    cx: dim1, cz: 1, cy: dim2,
                    deps: deps,
                    access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
                    dimX: DimStyle.n_vocab, dimY: DimStyle.C,
                    name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
                });
                zF -= (dim3 * dim3_cell + dim3_margin)
                cubes.push(m);
            }

            zF -= (dim3 * dim3_cell + dim3_margin)
        }


        xL += (s[0] * cell + margin);

    } else {
        let m = mk({
            t: 'w',
            xL: xL, zF: 0, y: y,
            cx: s[0], cz: 1, cy: s[1],
            deps: deps,
            access: { x: [0, 1, 0], y: [1, 0, 0], scale: 10 },
            dimX: DimStyle.n_vocab, dimY: DimStyle.C,
            name: String.fromCharCode(65 + i), // 'A', 'B', 'C', ...
        });
        xL += (s[0] * cell + margin);
        cubes.push(m);
    }
}
