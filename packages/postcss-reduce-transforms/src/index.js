import has from 'has';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import getMatchFactory from 'cssnano-util-get-match';

function getValues (list, {value}, index) {
    if (index % 2 === 0) {
        return [...list, parseFloat(value)];
    }
    return list;
}

function matrix3d (node, values) {
    // matrix3d(a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, tx, ty, 0, 1) => matrix(a, b, c, d, tx, ty)
    if (
        values[15]       &&
        values[2]  === 0 &&
        values[3]  === 0 &&
        values[6]  === 0 &&
        values[7]  === 0 &&
        values[8]  === 0 &&
        values[9]  === 0 &&
        values[10] === 1 &&
        values[11] === 0 &&
        values[14] === 0 &&
        values[15] === 1
    ) {
        const {nodes} = node;
        node.value = 'matrix';
        node.nodes = [
            nodes[0],  // a
            nodes[1],  // ,
            nodes[2],  // b
            nodes[3],  // ,
            nodes[8],  // c
            nodes[9],  // ,
            nodes[10], // d
            nodes[11], // ,
            nodes[24], // tx
            nodes[25], // ,
            nodes[26], // ty
        ];
    }
}

const rotate3dMappings = [
    ['rotateX', [1, 0, 0]], // rotate3d(1, 0, 0, a) => rotateX(a)
    ['rotateY', [0, 1, 0]], // rotate3d(0, 1, 0, a) => rotateY(a)
    ['rotate',  [0, 0, 1]], // rotate3d(0, 0, 1, a) => rotate(a)
];

const rotate3dMatch = getMatchFactory(rotate3dMappings);

function rotate3d (node, values) {
    const {nodes} = node;
    const match = rotate3dMatch(values.slice(0, 3));
    if (match.length) {
        node.value = match;
        node.nodes = [nodes[6]];
    }
}

function rotateZ (node) {
    // rotateZ(rz) => rotate(rz)
    node.value = 'rotate';
}

function scale (node, values) {
    const {nodes} = node;
    if (!nodes[2]) {
        return;
    }
    const [first, second] = values;
    // scale(sx, sy) => scale(sx)
    if (first === second) {
        node.nodes = [nodes[0]];
        return;
    }
    // scale(sx, 1) => scaleX(sx)
    if (second === 1) {
        node.value = 'scaleX';
        node.nodes = [nodes[0]];
        return;
    }
    // scale(1, sy) => scaleY(sy)
    if (first === 1) {
        node.value = 'scaleY';
        node.nodes = [nodes[2]];
        return;
    }
}

function scale3d (node, values) {
    const {nodes} = node;
    const [first, second, third] = values;
    // scale3d(sx, 1, 1) => scaleX(sx)
    if (second === 1 && third === 1) {
        node.value = 'scaleX';
        node.nodes = [nodes[0]];
        return;
    }
    // scale3d(1, sy, 1) => scaleY(sy)
    if (first === 1 && third === 1) {
        node.value = 'scaleY';
        node.nodes = [nodes[2]];
        return;
    }
    // scale3d(1, 1, sz) => scaleZ(sz)
    if (first === 1 && second === 1) {
        node.value = 'scaleZ';
        node.nodes = [nodes[4]];
        return;
    }
}

function translate (node, values) {
    const {nodes} = node;
    if (!nodes[2]) {
        return;
    }
    // translate(tx, 0) => translate(tx)
    if (values[1] === 0) {
        node.nodes = [nodes[0]];
        return;
    }
    // translate(0, ty) => translateY(ty)
    if (values[0] === 0) {
        node.value = 'translateY';
        node.nodes = [nodes[2]];
        return;
    }
}

function translate3d (node, values) {
    const {nodes} = node;
    // translate3d(0, 0, tz) => translateZ(tz)
    if (values[0] === 0 && values[1] === 0) {
        node.value = 'translateZ';
        node.nodes = [nodes[4]];
    }
}

const reducers = {
    matrix3d,
    rotate3d,
    rotateZ,
    scale,
    scale3d,
    translate,
    translate3d,
};

function reduce (node) {
    const {nodes, type, value} = node;
    if (type === 'function' && has(reducers, value)) {
        reducers[value](node, nodes.reduce(getValues, []));
    }
    return false;
}

export default postcss.plugin('postcss-reduce-transforms', () => {
    return css => {
        css.walkDecls(/transform$/, decl => {
            decl.value = valueParser(decl.value).walk(reduce).toString();
        });
    };
});
