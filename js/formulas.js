/**
 * formulas.js - recursive-descent parser and compiler for 2D and 3D expressions.
 * Exposes `Formulas` without using eval() or external libraries.
 * @module Formulas
 */
(function (global) {
  'use strict';

  class FormulaError extends Error {}

  const fail = (m) => { throw new FormulaError(m); };

  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    let s = c[0];
    for (let i = 1; i < 9; i++) s += c[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * s;
  }

  function factorial(n) {
    if (n < 0 && Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    if (Number.isInteger(n)) {
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    return gamma(n + 1);
  }

  function root(n, x) {
    if (x < 0) return Number.isInteger(n) && Math.abs(n % 2) === 1 ? -Math.pow(-x, 1 / n) : NaN;
    return Math.pow(x, 1 / n);
  }

  const FUNCTIONS = {
    sin: [1, 1, Math.sin], cos: [1, 1, Math.cos], tan: [1, 1, Math.tan],
    sec: [1, 1, (x) => 1 / Math.cos(x)], csc: [1, 1, (x) => 1 / Math.sin(x)], cot: [1, 1, (x) => 1 / Math.tan(x)],
    asin: [1, 1, Math.asin], acos: [1, 1, Math.acos], atan: [1, 1, Math.atan], atan2: [2, 2, Math.atan2],
    sinh: [1, 1, Math.sinh], cosh: [1, 1, Math.cosh], tanh: [1, 1, Math.tanh],
    asinh: [1, 1, Math.asinh], acosh: [1, 1, Math.acosh], atanh: [1, 1, Math.atanh],
    sqrt: [1, 1, Math.sqrt], cbrt: [1, 1, Math.cbrt], root: [2, 2, root],
    abs: [1, 1, Math.abs], exp: [1, 1, Math.exp], ln: [1, 1, Math.log],
    log: [1, 2, (a, b) => (b === undefined ? Math.log10(a) : Math.log(b) / Math.log(a))],
    log10: [1, 1, Math.log10], log2: [1, 1, Math.log2],
    floor: [1, 1, Math.floor], ceil: [1, 1, Math.ceil], round: [1, 1, Math.round],
    sign: [1, 1, Math.sign], min: [1, 99, Math.min], max: [1, 99, Math.max],
    mod: [2, 2, (a, b) => a - b * Math.floor(a / b)], gamma: [1, 1, gamma],
  };

  const ALIASES = {
    sen: 'sin', tg: 'tan', ctg: 'cot', cosec: 'csc', arcsin: 'asin', arcsen: 'asin', arccos: 'acos',
    arctan: 'atan', arctg: 'atan', asen: 'asin', senh: 'sinh', tgh: 'tanh', raiz: 'sqrt', signo: 'sign',
  };

  const CONSTANTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
  const INVERSES = { sin: 'asin', cos: 'acos', tan: 'atan', sinh: 'asinh', cosh: 'acosh', tanh: 'atanh' };
  const RESERVED = new Set(['x', 'y', 'z', 't', 'θ']);

  function tokenize(text, custom) {
    const s = text.replace(/[−–]/g, '-').replace(/[·×∙]/g, '*').replace(/÷/g, '/')
      .replace(/\*\*/g, '^').replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/≤/g, '<=').replace(/≥/g, '>=');
    const names = [...Object.keys(FUNCTIONS), ...Object.keys(ALIASES), 'pi', 'tau', 'theta', ...custom]
      .sort((a, b) => b.length - a.length);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      let m = /^(\d+(\.\d*)?|\.\d+)/.exec(s.slice(i));
      if (m) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (c === 'π') { out.push({ t: 'id', v: 'pi' }); i++; continue; }
      if (c === 'τ') { out.push({ t: 'id', v: 'tau' }); i++; continue; }
      if (c === 'θ') { out.push({ t: 'id', v: 'θ' }); i++; continue; }
      if (c === '√') { out.push({ t: 'id', v: 'sqrt' }); i++; continue; }
      if (/[A-Za-zñÑα-ω]/.test(c)) {
        const known = names.find((n) => s.startsWith(n, i));
        if (known) {
          let v = ALIASES[known] || known;
          if (v === 'theta') v = 'θ';
          out.push({ t: 'id', v });
          i += known.length;
        } else {
          let v = c;
          i++;
          if (!/[xyze]/.test(c)) {
            m = /^(_[A-Za-z0-9]+|\d+)/.exec(s.slice(i));
            if (m) { v += m[0]; i += m[0].length; }
          }
          out.push({ t: 'id', v });
        }
        continue;
      }
      const pair = s.slice(i, i + 2);
      if (pair === '<=' || pair === '>=') { out.push({ t: pair }); i += 2; continue; }
      if ("+-*/^!(),|{}=<>'".includes(c)) { out.push({ t: c }); i++; continue; }
      fail(`Unrecognized character: “${c}”`);
    }
    return out;
  }

  function parse(tokens, custom) {
    let p = 0, bars = 0;
    const peek = () => tokens[p] || { t: 'end' };
    const take = () => tokens[p++] || { t: 'end' };
    const expect = (t) => {
      if (peek().t !== t) fail(t === ')' ? 'Missing closing parenthesis' : `Missing “${t}”`);
      p++;
    };
    const isFunction = (n) => Object.prototype.hasOwnProperty.call(FUNCTIONS, n) || custom.has(n);
    const startsFactor = () => {
      const k = peek();
      return k.t === 'id' || k.t === '(' || (k.t === '|' && bars === 0);
    };

    function expr() {
      let a = term();
      while (peek().t === '+' || peek().t === '-') {
        const op = take().t;
        a = { t: 'bin', op, a, b: term() };
      }
      return a;
    }
    function term() {
      let a = unary();
      for (;;) {
        if (peek().t === '*' || peek().t === '/') {
          const op = take().t;
          a = { t: 'bin', op, a, b: unary() };
        } else if (startsFactor()) {
          a = { t: 'bin', op: '*', a, b: power() };
        } else {
          return a;
        }
      }
    }
    function unary() {
      if (peek().t === '-') { p++; return { t: 'neg', a: unary() }; }
      if (peek().t === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      const base = postfix();
      if (peek().t === '^') { p++; return { t: 'bin', op: '^', a: base, b: unary() }; }
      return base;
    }
    function postfix() {
      let a = primary();
      while (peek().t === '!') { p++; a = { t: 'fact', a }; }
      return a;
    }
    function list() {
      const items = [expr()];
      while (peek().t === ',') { p++; items.push(expr()); }
      return items;
    }
    function primary() {
      const k = take();
      if (k.t === 'num') return { t: 'num', v: k.v };
      if (k.t === '(') {
        const saved = bars; bars = 0;
        const items = list(); expect(')'); bars = saved;
        return items.length === 1 ? items[0] : { t: 'tuple', items };
      }
      if (k.t === '|') {
        bars++; const a = expr(); expect('|'); bars--;
        return { t: 'call', f: 'abs', args: [a], prime: 0 };
      }
      if (k.t === 'id') return isFunction(k.v) ? call(k.v) : { t: 'var', n: k.v };
      if (k.t === 'end') fail('Formula is incomplete');
      return fail(`Unexpected “${k.t}” here`);
    }
    function call(f) {
      let prime = 0;
      while (peek().t === "'") { p++; prime++; }
      if (prime > 2) fail('Only first and second derivatives are supported');
      let exponent = null;
      if (peek().t === '^') {
        p++;
        exponent = peek().t === '-' ? (p++, { t: 'neg', a: primary() }) : primary();
      }
      let args;
      if (peek().t === '(') {
        p++;
        const saved = bars; bars = 0;
        args = list(); expect(')'); bars = saved;
      } else {
        if (peek().t === 'end') fail(`Missing argument for ${f}`);
        let a = unary();
        while (startsFactor() && !(peek().t === 'id' && isFunction(peek().v))) {
          a = { t: 'bin', op: '*', a, b: power() };
        }
        args = [a];
      }
      if (exponent && exponent.t === 'neg' && exponent.a.t === 'num' && exponent.a.v === 1 && INVERSES[f]) {
        return { t: 'call', f: INVERSES[f], args, prime };
      }
      const node = { t: 'call', f, args, prime };
      return exponent ? { t: 'bin', op: '^', a: node, b: exponent } : node;
    }

    const items = list();
    if (p < tokens.length) {
      fail(peek().t === ')' ? 'Extra closing parenthesis' : `Unexpected “${peek().v ?? peek().t}” here`);
    }
    return items.length === 1 ? items[0] : { t: 'tuple', items };
  }

  function splitRelations(tokens) {
    const parts = [[]], ops = [];
    let level = 0;
    for (const k of tokens) {
      if (k.t === '(') level++;
      if (k.t === ')') level--;
      if (level === 0 && ['=', '<', '>', '<=', '>='].includes(k.t)) {
        ops.push(k.t);
        parts.push([]);
      } else {
        parts[parts.length - 1].push(k);
      }
    }
    return { parts, ops };
  }

  function variables(node, defs, acc = new Set(), stack = new Set()) {
    if (!node) return acc;
    switch (node.t) {
      case 'var':
        if (!(node.n in CONSTANTS)) acc.add(node.n);
        break;
      case 'neg':
      case 'fact':
        variables(node.a, defs, acc, stack);
        break;
      case 'bin':
        variables(node.a, defs, acc, stack);
        variables(node.b, defs, acc, stack);
        break;
      case 'tuple':
        node.items.forEach((n) => variables(n, defs, acc, stack));
        break;
      case 'call':
        node.args.forEach((n) => variables(n, defs, acc, stack));
        break;
    }
    return acc;
  }

  function compile(node, ctx) {
    switch (node.t) {
      case 'num': { const v = node.v; return () => v; }
      case 'var': {
        const n = node.n;
        if (ctx.locals.has(n)) return (s) => s[n];
        if (n in CONSTANTS) { const v = CONSTANTS[n]; return () => v; }
        const def = ctx.defs.consts.get(n);
        if (def && !def.literal) {
          if (ctx.stack.has(n)) fail(`Circular definition of “${n}”`);
          ctx.stack.add(n);
          const f = compile(def.ast, { ...ctx, locals: new Set() });
          ctx.stack.delete(n);
          return () => f(ctx.globals);
        }
        if (RESERVED.has(n)) fail(`Variable “${n}” cannot be used here`);
        ctx.parameters.add(n);
        return () => ctx.globals[n];
      }
      case 'neg': { const a = compile(node.a, ctx); return (s) => -a(s); }
      case 'fact': { const a = compile(node.a, ctx); return (s) => factorial(a(s)); }
      case 'tuple': return fail('Unexpected comma here. Use a dot for decimals: 2.5');
      case 'bin': {
        const a = compile(node.a, ctx), b = compile(node.b, ctx);
        switch (node.op) {
          case '+': return (s) => a(s) + b(s);
          case '-': return (s) => a(s) - b(s);
          case '*': return (s) => a(s) * b(s);
          case '/': return (s) => a(s) / b(s);
          default: {
            const e = node.b;
            if (
              e.t === 'bin' && e.op === '/' &&
              e.a.t === 'num' && e.b.t === 'num' &&
              Number.isInteger(e.a.v) && Number.isInteger(e.b.v) &&
              e.b.v % 2 === 1
            ) {
              const num = e.a.v;
              return (s) => {
                const base = a(s), r = Math.pow(Math.abs(base), b(s));
                return base < 0 && num % 2 !== 0 ? -r : r;
              };
            }
            return (s) => Math.pow(a(s), b(s));
          }
        }
      }
      case 'call': {
        const args = node.args.map((n) => compile(n, ctx));
        const customFn = ctx.defs.funcs.get(node.f);
        let f;
        if (customFn) {
          if (args.length !== customFn.params.length) fail(`${node.f} requires ${customFn.params.length} argument(s)`);
          if (ctx.stack.has(node.f)) fail(`“${node.f}” calls itself`);
          ctx.stack.add(node.f);
          const body = compile(customFn.ast, { ...ctx, locals: new Set(customFn.params) });
          ctx.stack.delete(node.f);
          const local = Object.create(ctx.globals);
          const names = customFn.params;
          f = (...v) => {
            const prev = names.map((n) => local[n]);
            for (let i = 0; i < names.length; i++) local[names[i]] = v[i];
            const r = body(local);
            for (let i = 0; i < names.length; i++) local[names[i]] = prev[i];
            return r;
          };
        } else {
          const [min, max, fn] = FUNCTIONS[node.f];
          if (args.length < min || args.length > max) fail(`${node.f} requires ${min} argument(s)`);
          f = fn;
        }
        if (node.prime) {
          if (args.length !== 1) fail('Derivative is only available for single-argument functions');
          const base = f;
          f = node.prime === 1 ? (x) => derivative(base, x) : (x) => derivative2(base, x);
        }
        if (args.length === 1) { const a = args[0]; return (s) => f(a(s)); }
        if (args.length === 2) { const [a, b] = args; return (s) => f(a(s), b(s)); }
        return (s) => f(...args.map((a) => a(s)));
      }
    }
    return fail('Invalid expression');
  }

  function derivative(f, x) {
    const h = 1e-6 * Math.max(1, Math.abs(x));
    return (f(x + h) - f(x - h)) / (2 * h);
  }

  function derivative2(f, x) {
    const h = 1e-4 * Math.max(1, Math.abs(x));
    return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  }

  const NAME_RE = /^\s*([A-Za-z](?:_[A-Za-z0-9]+|\d+)?)\s*\(\s*([A-Za-zθ](?:\s*,\s*[A-Za-z])*)\s*\)\s*=(?!=)/;

  function compileAll(texts, globals) {
    const defs = { funcs: new Map(), consts: new Map() };
    const custom = new Set();
    texts.forEach((t) => {
      const m = NAME_RE.exec(t);
      if (m && !['x', 'y', 'z', 'r', 'e'].includes(m[1]) && !(m[1] in FUNCTIONS) && !(m[1] in ALIASES)) {
        custom.add(m[1]);
      }
    });

    const lines = texts.map((text) => {
      try { return classify(text, defs, custom); }
      catch (e) { return { type: 'error', error: message(e) }; }
    });

    const parameters = new Set();
    const result = lines.map((l) => {
      if (l.type === 'error' || l.type === 'empty') return l;
      try { return build(l, { defs, globals, parameters, stack: new Set() }); }
      catch (e) { return { type: 'error', error: message(e) }; }
    });

    for (const [n, d] of defs.consts) if (d.literal) parameters.delete(n);
    return { lines: result, parameters: [...parameters].sort() };
  }

  const message = (e) => (e instanceof FormulaError ? e.message
    : e instanceof RangeError ? 'Formula is too complex' : 'Cannot parse formula');

  function classify(text, defs, custom) {
    if (!text.trim() || text.trim().startsWith('#')) return { type: 'empty' };
    let tokens = tokenize(text, custom);

    const conditions = [];
    while (tokens.length && tokens[tokens.length - 1].t === '}') {
      const start = tokens.map((k) => k.t).lastIndexOf('{');
      if (start < 0) fail('Missing “{”');
      const inside = tokens.slice(start + 1, -1);
      const groups = [[]];
      let level = 0;
      for (const k of inside) {
        if (k.t === '(') level++;
        if (k.t === ')') level--;
        if (k.t === ',' && level === 0) groups.push([]);
        else groups[groups.length - 1].push(k);
      }
      for (const g of groups) {
        const { parts, ops } = splitRelations(g);
        if (!ops.length) fail('Condition inside braces needs <, > or =');
        conditions.push({ sides: parts.map((q) => parse(q, custom)), ops });
      }
      tokens = tokens.slice(0, start);
    }
    if (tokens.some((k) => k.t === '{' || k.t === '}')) fail('Braces { } go at the end of the formula');

    const { parts, ops } = splitRelations(tokens);
    if (ops.length > 1) fail('Use a single relation. To restrict the domain: y = x {0 < x < 2}');
    if (parts.some((q) => !q.length)) fail('Formula is incomplete');
    const base = { conditions };

    const m = NAME_RE.exec(text);
    if (m && custom.has(m[1]) && ops[0] === '=') {
      const params = m[2].split(',').map((q) => q.trim()).map((q) => (q === 'theta' ? 'θ' : q));
      if (defs.funcs.has(m[1])) fail(`“${m[1]}” is already defined`);
      const ast = parse(parts[1], custom);
      defs.funcs.set(m[1], { params, ast });
      return { ...base, type: 'function', name: m[1], params, ast };
    }
    if (/^\s*y\s*\(\s*x\s*\)\s*=/.test(text)) {
      return { ...base, type: 'explicit', ast: parse(parts[1], custom) };
    }
    if (/^\s*z\s*\(\s*x\s*,\s*y\s*\)\s*=/.test(text)) {
      return { ...base, type: 'surface3d', ast: parse(parts[1], custom) };
    }

    const sides = parts.map((q) => parse(q, custom));
    const vars = sides.map((n) => variables(n, defs));
    const isVar = (i, n) => sides[i].t === 'var' && sides[i].n === n;

    if (!ops.length) {
      const a = sides[0];
      if (a.t === 'tuple') {
        if (a.items.length === 3) {
          return { ...base, type: vars[0].has('t') ? 'parametric3d' : 'point3d', ast: a };
        }
        if (a.items.length !== 2) fail('A point or parametric curve needs 2 or 3 components');
        return { ...base, type: vars[0].has('t') ? 'parametric' : 'point', ast: a };
      }
      if (vars[0].has('z')) fail('Add “=” to plot an equation with z');
      if (vars[0].has('y')) fail('Add “=” to plot an equation with y');
      if (vars[0].has('θ')) return { ...base, type: 'polar', ast: a };
      return { ...base, type: 'explicit', ast: a };
    }

    const op = ops[0];
    const [lhs, rhs] = sides;
    if (op === '=') {
      if (isVar(0, 'z') && !vars[1].has('z')) return { ...base, type: 'surface3d', ast: rhs };
      if (isVar(1, 'z') && !vars[0].has('z')) return { ...base, type: 'surface3d', ast: lhs };
      if (isVar(0, 'y') && !vars[1].has('y') && !vars[1].has('z')) return { ...base, type: 'explicit', ast: rhs };
      if (isVar(1, 'y') && !vars[0].has('y') && !vars[0].has('z')) return { ...base, type: 'explicit', ast: lhs };
      if (isVar(0, 'x') && !vars[1].has('x') && !vars[1].has('z')) return { ...base, type: 'explicitX', ast: rhs };
      if (isVar(0, 'r') && !vars[1].has('x') && !vars[1].has('y') && !vars[1].has('z') && !vars[1].has('r')) {
        return { ...base, type: 'polar', ast: rhs };
      }
      if (
        lhs.t === 'var' &&
        !['x', 'y', 'z', 't', 'θ', 'e', 'pi', 'tau'].includes(lhs.n) &&
        !vars[1].has('x') && !vars[1].has('y') && !vars[1].has('z') && !vars[1].has('θ')
      ) {
        if (defs.consts.has(lhs.n)) fail(`“${lhs.n}” is already defined`);
        const literal = rhs.t === 'num' || (rhs.t === 'neg' && rhs.a.t === 'num');
        const def = { ast: rhs, literal, value: literal ? (rhs.t === 'num' ? rhs.v : -rhs.a.v) : null };
        defs.consts.set(lhs.n, def);
        return { ...base, type: 'constant', name: lhs.n, ...def };
      }
    }
    if (!vars.some((v) => v.has('x') || v.has('y') || v.has('z'))) fail('The equation must contain x, y or z');
    const ast = { t: 'bin', op: '-', a: lhs, b: rhs };
    if (op === '=') return { ...base, type: 'implicit', ast };
    const fill = { ...base, type: 'inequality', ast, op };
    const greater = op[0] === '>';
    if (isVar(0, 'y') && !vars[1].has('y')) return { ...fill, border: { axis: 'y', ast: rhs, greater } };
    if (isVar(1, 'y') && !vars[0].has('y')) return { ...fill, border: { axis: 'y', ast: lhs, greater: !greater } };
    if (isVar(0, 'x') && !vars[1].has('x')) return { ...fill, border: { axis: 'x', ast: rhs, greater } };
    if (isVar(1, 'x') && !vars[0].has('x')) return { ...fill, border: { axis: 'x', ast: lhs, greater: !greater } };
    return fill;
  }

  const COMPARE = {
    '<': (a, b) => a < b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
    '=': (a, b) => Math.abs(a - b) < 1e-9,
  };

  function build(l, ctx) {
    const { globals } = ctx;
    const make = (ast, locals) => compile(ast, { ...ctx, locals: new Set(locals) });
    const condition = (locals) => {
      if (!l.conditions.length) return null;
      const list = l.conditions.map((c) => ({ f: c.sides.map((n) => make(n, locals)), ops: c.ops }));
      return (s) => list.every((c) => c.ops.every((op, i) => COMPARE[op](c.f[i](s), c.f[i + 1](s))));
    };
    const s = Object.create(globals);
    const r = { type: l.type };

    switch (l.type) {
      case 'function': {
        const f = make(l.ast, l.params), c = condition(l.params);
        r.name = l.name; r.params = l.params;
        if (l.params.length === 1) {
          const v = l.params[0];
          r.type = v === 'y' ? 'explicitX' : v === 'θ' ? 'polar' : 'explicit';
          r.f = (u) => { s[v] = u; const w = f(s); if (c && !c(s)) return NaN; return w; };
          if (r.type === 'polar') r.usesRange = true;
        } else if (l.params.length === 2 && l.params[0] === 'x' && l.params[1] === 'y') {
          r.type = 'surface3d';
          r.f = (x, y) => { s.x = x; s.y = y; const z = f(s); if (c) { s.z = z; if (!c(s)) return NaN; } return z; };
        }
        return r;
      }
      case 'surface3d': {
        const f = make(l.ast, ['x', 'y']), c = condition(['x', 'y', 'z']);
        r.f = (x, y) => { s.x = x; s.y = y; const z = f(s); if (c) { s.z = z; if (!c(s)) return NaN; } return z; };
        return r;
      }
      case 'explicit':
      case 'explicitX': {
        const ind = l.type === 'explicit' ? 'x' : 'y', dep = l.type === 'explicit' ? 'y' : 'x';
        const f = make(l.ast, [ind]), c = condition(['x', 'y']);
        r.f = (u) => { s[ind] = u; const w = f(s); if (c) { s[dep] = w; if (!c(s)) return NaN; } return w; };
        return r;
      }
      case 'polar': {
        const f = make(l.ast, ['θ']), c = condition(['θ', 'x', 'y']);
        r.usesRange = true;
        r.f = (u) => {
          s['θ'] = u; const w = f(s);
          if (c) { s.x = w * Math.cos(u); s.y = w * Math.sin(u); if (!c(s)) return NaN; }
          return w;
        };
        return r;
      }
      case 'parametric': {
        const fx = make(l.ast.items[0], ['t']), fy = make(l.ast.items[1], ['t']), c = condition(['t', 'x', 'y']);
        r.usesRange = true;
        r.f = (u) => {
          s.t = u; const x = fx(s), y = fy(s);
          if (c) { s.x = x; s.y = y; if (!c(s)) return [NaN, NaN]; }
          return [x, y];
        };
        return r;
      }
      case 'parametric3d': {
        const fx = make(l.ast.items[0], ['t']), fy = make(l.ast.items[1], ['t']), fz = make(l.ast.items[2], ['t']);
        const c = condition(['t', 'x', 'y', 'z']);
        r.usesRange = true;
        r.f = (u) => {
          s.t = u; const x = fx(s), y = fy(s), z = fz(s);
          if (c) { s.x = x; s.y = y; s.z = z; if (!c(s)) return [NaN, NaN, NaN]; }
          return [x, y, z];
        };
        return r;
      }
      case 'point': {
        const fx = make(l.ast.items[0], []), fy = make(l.ast.items[1], []);
        r.f = () => [fx(s), fy(s)];
        return r;
      }
      case 'point3d': {
        const fx = make(l.ast.items[0], []), fy = make(l.ast.items[1], []), fz = make(l.ast.items[2], []);
        r.f = () => [fx(s), fy(s), fz(s)];
        return r;
      }
      case 'implicit':
      case 'inequality': {
        const f = make(l.ast, ['x', 'y', 'z']), c = condition(['x', 'y', 'z']);
        r.F = (x, y, z = 0) => { s.x = x; s.y = y; s.z = z; if (c && !c(s)) return NaN; return f(s); };
        if (l.type === 'inequality') {
          r.op = l.op;
          r.inside = (x, y, z = 0) => COMPARE[l.op](r.F(x, y, z), 0);
          if (l.border) {
            const ind = l.border.axis === 'y' ? 'x' : 'y';
            const g = make(l.border.ast, [ind]);
            const s2 = Object.create(globals);
            r.border = {
              axis: l.border.axis, greater: l.border.greater, restricted: !!c,
              f: (u) => { s2[ind] = u; return g(s2); },
            };
          }
        }
        return r;
      }
      case 'constant': {
        const f = make(l.ast, []);
        r.name = l.name; r.literal = l.literal; r.value = l.value;
        r.evaluate = () => f(s);
        return r;
      }
    }
    return r;
  }

  function evaluateNumber(text) {
    try {
      const ast = parse(tokenize(String(text), []), new Set());
      const ctx = {
        defs: { funcs: new Map(), consts: new Map() }, globals: Object.create(null),
        parameters: new Set(), stack: new Set(), locals: new Set(),
      };
      const f = compile(ast, ctx);
      return ctx.parameters.size ? NaN : f(ctx.globals);
    } catch (_) { return NaN; }
  }

  /**
   * Compiles one standalone expression that may only use the given variable names
   * (plus constants and built-in functions). Used by the ND formula box so that no
   * user text is ever executed as JavaScript.
   * @param {string} text expression such as "sin(x + y) * 1.4"
   * @param {string[]} names allowed variable names, in argument order
   * @returns {{fn: ?Function, error: string}}
   */
  function compileExpression(text, names) {
    try {
      const ast = parse(tokenize(String(text), []), new Set());
      const ctx = {
        defs: { funcs: new Map(), consts: new Map() }, globals: Object.create(null),
        parameters: new Set(), stack: new Set(), locals: new Set([...names, 'θ']),
      };
      const f = compile(ast, ctx);
      if (ctx.parameters.size) fail(`Unknown variable “${[...ctx.parameters][0]}”`);
      const scope = Object.create(null);
      const tIndex = names.indexOf('t');
      const fn = (...values) => {
        for (let i = 0; i < names.length; i++) scope[names[i]] = values[i];
        scope['θ'] = tIndex >= 0 ? values[tIndex] : 0;
        return f(scope);
      };
      return { fn, error: '' };
    } catch (e) {
      return { fn: null, error: message(e) };
    }
  }

  const api = { compileAll, compileExpression, evaluateNumber, derivative };
  global.Formulas = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);