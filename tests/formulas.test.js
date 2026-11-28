'use strict';
// Run with: node tests/formulas.test.js
const assert = require('node:assert/strict');
const Formulas = require('../js/formulas.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

const compile = (text, params = {}) => {
  const globals = Object.assign(Object.create(null), params);
  const { lines, parameters } = Formulas.compileAll([text], globals);
  return { line: lines[0], parameters, globals };
};
const evalExplicit = (text, x, params) => compile(text, params).line.f(x);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

test('classifies the main formula kinds', () => {
  const kinds = {
    'y = sin(x)': 'explicit',
    'z = sin(x) * cos(y)': 'surface3d',
    'r = 1 + cos(theta)': 'polar',
    'x^2 + y^2 = 9': 'implicit',
    'y < sin(x)': 'inequality',
    '(cos(t), sin(t))': 'parametric',
    '(cos(t), sin(t), t/4)': 'parametric3d',
    '(1, 2)': 'point',
    '(1, 2, 3)': 'point3d',
    'a = 3': 'constant',
  };
  for (const [text, type] of Object.entries(kinds)) assert.equal(compile(text).line.type, type, text);
});

test('operator precedence', () => {
  close(evalExplicit('y = -x^2', 3), -9);
  close(evalExplicit('y = 2^3^2', 0), 512);
  close(evalExplicit('y = 2^-3', 0), 0.125);
  close(evalExplicit('y = 2x^2', 3), 18);
});

test('implicit multiplication and functions', () => {
  close(evalExplicit('y = sin^2(x) + cos^2(x)', 1.234), 1);
  close(evalExplicit('y = |x|', -4), 4);
  close(evalExplicit('y = x!', 5), 120);
  close(evalExplicit('y = log(2, 8)', 0), 3);
  close(evalExplicit('y = x^(1/3)', -8), -2);
});

test('parameters become sliders and update dynamically', () => {
  const globals = Object.create(null);
  globals.a = 2;
  globals.b = 3;
  const { lines, parameters } = Formulas.compileAll(['y = a sin(b x)'], globals);
  assert.deepEqual(parameters, ['a', 'b']);
  close(lines[0].f(Math.PI / 6), 2);
  globals.a = 4;
  close(lines[0].f(Math.PI / 6), 4);
});

test('domain restriction returns NaN outside the domain', () => {
  const { line } = compile('y = 1.4 / x {x >= 0.6}');
  assert.ok(Number.isNaN(line.f(0.1)));
  close(line.f(2), 0.7);
});

test('chained piecewise conditions enforce all constraints', () => {
  const { line } = compile('y = x^2 {x >= -1, x <= 2}');
  assert.ok(Number.isNaN(line.f(-2)));
  assert.ok(Number.isNaN(line.f(3)));
  close(line.f(1.5), 2.25);
});

test('custom functions, 2D surfaces, and derivatives', () => {
  const { lines } = Formulas.compileAll([
    'f(x) = x^2',
    "y = f'(x)",
    'g(x, y) = x + 2y',
  ], Object.create(null));
  close(lines[1].f(3), 6, 1e-4);
  assert.equal(lines[2].type, 'surface3d');
  close(lines[2].f(1, 4), 9);
});

test('inequality inside check', () => {
  const { line } = compile('x^2 + y^2 <= 9');
  assert.equal(line.type, 'inequality');
  assert.equal(line.inside(1, 1), true);
  assert.equal(line.inside(3, 3), false);
});

test('errors are reported, not thrown', () => {
  for (const text of ['y = (', 'y = 1 +', '2 = = 3', 'y = 3 $ x', 'y = x {x}']) {
    assert.equal(compile(text).line.type, 'error', text);
  }
});

test('evaluateNumber', () => {
  close(Formulas.evaluateNumber('2pi'), 2 * Math.PI);
  assert.ok(Number.isNaN(Formulas.evaluateNumber('a + 1')));
  assert.ok(Number.isNaN(Formulas.evaluateNumber('(')));
});

test('compileExpression supports allowed ND variables and blocks arbitrary code', () => {
  const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's', 'r', 'q', 'p', 'i', 'd'];
  const ok = Formulas.compileExpression('sin(x + y) * 1.4', names);
  assert.ok(ok.fn);
  close(ok.fn(1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4), Math.sin(3) * 1.4);

  const indexed = Formulas.compileExpression('cos(i * 0.5) + d * 0.1', names);
  assert.ok(indexed.fn);
  close(indexed.fn(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 5), Math.cos(1) + 0.5);

  for (const text of ["Reflect.get(Math.sin,'cons'+'tructor')('1')()", 'alert(1)', 'process.exit()', 'foo(x)', 'x + m']) {
    assert.equal(Formulas.compileExpression(text, names).fn, null, text);
  }
});

console.log(`\n${passed} tests passed`);