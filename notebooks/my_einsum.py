import torch

def init_list(shape):
    if len(shape) == 0: return []

    li = [init_list(shape[1:]) for _ in range(shape[0])]
    return li


def _set_item(li, idx, value):
    if len(idx) == 1:
        li[idx[0]] = value
        return

    _set_item(li[idx[0]], idx[1:], value)


def _get_item(li, idx):
    if len(idx) == 1: return li[idx[0]]
    return _get_item(li[idx[0]], idx[1:])



class MultidimList:
    def __init__(self, shape):
        self.shape = shape
        self.li = init_list(shape)

    def __getitem__(self, idx):
        return _get_item(self.li, idx)

    def __setitem__(self, idx, value):
        return _set_item(self.li, idx, value)

    def __repr__(self): return str(self.li)


def _iterate(size_tuple):
    if len(size_tuple) == 0: return ((),)
    smaller_iters = _iterate(size_tuple[1:])
    return tuple((s,) + coords for s in range(size_tuple[0]) for coords in smaller_iters)

def iterate(dims, dim2size):
    size_tuple = tuple(dim2size[d]for d in dims)
    return _iterate(size_tuple)


def deindex(dims, idx, dim_names):
    """
    Convert between global `idx` coordinates with `dim_names`
    to the local coordinates given by `dims`
    """

    global_coords = {name:i for name,i in zip(dim_names, idx)}
    local_coords = tuple ( global_coords[name] for name in dims )
    return local_coords


def build_relation_map(equation, *operands):
    if '->' not in equation:
        equation += '->'

    inputs, outputs = equation.split('->')
    input_dims, output_dims = inputs.split(","), outputs.split(",")

    assert len(output_dims) == 1
    output_dim = output_dims[0]

    # print(output_dim)


    dim2size = {}

    for dims, operand in zip(input_dims, operands):
        for dim,size in zip(dims,operand.shape):
            # validation occurs here
            dim2size[dim] = size

    free_dims = output_dim
    summation_dims = "".join( list({d for dim in input_dims for d in dim} - set(free_dims)) )
    # print(dim2size)
    output_shape = [dim2size[d]for d in output_dim]



    is_scalar = len(output_shape) == 0

    if is_scalar:
        relmap = 0
    else:
        relmap = MultidimList(output_shape)

    dim_names = free_dims + summation_dims

    for free_idx in iterate(free_dims, dim2size):
        sum_coords = [] # suppose to sum over that

        for summation_idx in iterate(summation_dims, dim2size):
            idx = free_idx + summation_idx

            mul_coords = []

            for oi, (dims, o) in enumerate ( zip(input_dims, operands) ):
                local_idx = deindex(dims, idx, dim_names)
                # local_coords = {'operand_i': oi, 'local_idx': local_idx}
                mul_coords.append(local_idx)

            sum_coords.append( mul_coords )

        if is_scalar:
            relmap = sum_coords
        else:
            relmap[free_idx] = sum_coords


    return relmap, free_dims, dim2size


def sum_relmap(relmap, free_dims, dim2size, *operands):
    is_scalar = len(free_dims) == 0

    if is_scalar:
        R = 0

    else:
        output_shape = relmap.shape
        R = torch.empty(output_shape)

    for free_idx in iterate(free_dims, dim2size):
        if is_scalar:
            sum_coords = relmap
        else:
            sum_coords = relmap[free_idx]

        s = 0

        for sum_idx in sum_coords:
            m = 1

            for op, mul_idx in zip(operands, sum_idx):
                m *= op[mul_idx]

            s += m

        if is_scalar:
            R = s
        else:
            R[free_idx] = s

    return R


def all_dtype_equals(operands):
    t = operands[0].dtype
    for o in operands[1:]:
        if t != o.dtype: return False
    return True

def my_einsum(equation, *operands):
    relmap, free_dims, dim2size = build_relation_map(equation, *operands)
    R = sum_relmap(relmap, free_dims, dim2size, *operands)

    if all_dtype_equals(operands):
        R = R.to(dtype=operands[0].dtype)

    return R
