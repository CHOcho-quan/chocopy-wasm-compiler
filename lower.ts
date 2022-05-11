import * as AST from './ast';
import * as IR from './ir';
import { Type } from './ast';
import { GlobalEnv } from './compiler';
import { BOOL, NONE, NUM } from './utils'

const nameCounters : Map<string, number> = new Map();
function generateName(base : string) : string {
  if(nameCounters.has(base)) {
    var cur = nameCounters.get(base);
    nameCounters.set(base, cur + 1);
    return base + (cur + 1);
  }
  else {
    nameCounters.set(base, 1);
    return base + 1;
  }
}

// function lbl(a: Type, base: string) : [string, IR.Stmt<Type>] {
//   const name = generateName(base);
//   return [name, {tag: "label", a: a, name: name}];
// }

export function lowerProgram(p : AST.Program<Type>, env : GlobalEnv) : IR.Program<Type> {
    console.log(JSON.stringify(p, null, 4));
    var blocks : Array<IR.BasicBlock<Type>> = [];
    var firstBlock : IR.BasicBlock<Type> = {  a: p.a, label: generateName("$startProg"), stmts: [] }
    blocks.push(firstBlock);
    var inits = flattenStmts(p.stmts, blocks, env);
    return {
        a: p.a,
        funs: lowerFunDefs(p.funs, env),
        inits: [...inits, ...lowerVarInits(p.inits, env)],
        classes: lowerClasses(p.classes, env),
        body: blocks
    }
}

function lowerFunDefs(fs : Array<AST.FunDef<Type>>, env : GlobalEnv) : Array<IR.FunDef<Type>> {
    return fs.map(f => lowerFunDef(f, env)).flat();
}

function lowerFunDef(f : AST.FunDef<Type>, env : GlobalEnv) : IR.FunDef<Type> {
  var blocks : Array<IR.BasicBlock<Type>> = [];
  var firstBlock : IR.BasicBlock<Type> = {  a: f.a, label: generateName("$startFun"), stmts: [] }
  blocks.push(firstBlock);
  var bodyinits = flattenStmts(f.body, blocks, env);
    return {...f, inits: [...bodyinits, ...lowerVarInits(f.inits, env)], body: blocks}
}

function lowerVarInits(inits: Array<AST.VarInit<Type>>, env: GlobalEnv) : Array<IR.VarInit<Type>> {
    return inits.map(i => lowerVarInit(i, env));
}

function lowerVarInit(init: AST.VarInit<Type>, env: GlobalEnv) : IR.VarInit<Type> {
    return {
        ...init,
        value: literalToVal(init.value)
    }
}

function lowerClasses(classes: Array<AST.Class<Type>>, env : GlobalEnv) : Array<IR.Class<Type>> {
    return classes.map(c => lowerClass(c, env));
}

function lowerClass(cls: AST.Class<Type>, env : GlobalEnv) : IR.Class<Type> {
    return {
        ...cls,
        fields: lowerVarInits(cls.fields, env),
        methods: lowerFunDefs(cls.methods, env)
    }
}

function literalToVal(lit: AST.Literal) : IR.Value<Type> {
    switch(lit.tag) {
        case "num":
            return { ...lit, value: BigInt(lit.value) }
        case "bool":
            return lit
        case "none":
            return lit        
    }
}

function flattenStmts(s : Array<AST.Stmt<Type>>, blocks: Array<IR.BasicBlock<Type>>, env : GlobalEnv) : Array<IR.VarInit<Type>> {
  var inits: Array<IR.VarInit<Type>> = [];
  s.forEach(stmt => {
    inits.push(...flattenStmt(stmt, blocks, env));
  });
  return inits;
}

function flattenStmt(s : AST.Stmt<Type>, blocks: Array<IR.BasicBlock<Type>>, env : GlobalEnv) : Array<IR.VarInit<Type>> {
  switch(s.tag) {
    case "assign":
      var [valinits, valstmts, vale] = flattenExprToExpr(s.value, env);
      blocks[blocks.length - 1].stmts.push(...valstmts, { a: s.a, tag: "assign", name: s.name, value: vale});
      return valinits
      // return [valinits, [
      //   ...valstmts,
      //   { a: s.a, tag: "assign", name: s.name, value: vale}
      // ]];

    case "return":
    var [valinits, valstmts, val] = flattenExprToVal(s.value, env);
    blocks[blocks.length - 1].stmts.push(
         ...valstmts,
         {tag: "return", a: s.a, value: val}
    );
    return valinits;
    // return [valinits, [
    //     ...valstmts,
    //     {tag: "return", a: s.a, value: val}
    // ]];
  
    case "expr":
      var [inits, stmts, e] = flattenExprToExpr(s.expr, env);
      blocks[blocks.length - 1].stmts.push(
        ...stmts, {tag: "expr", a: s.a, expr: e }
      );
      return inits;
    //  return [inits, [ ...stmts, {tag: "expr", a: s.a, expr: e } ]];

    case "pass":
      return [];

    case "field-assign": {
      var [oinits, ostmts, oval] = flattenExprToVal(s.obj, env);
      var [ninits, nstmts, nval] = flattenExprToVal(s.value, env);
      if(s.obj.a.tag !== "class") { throw new Error("Compiler's cursed, go home."); }
      const classdata = env.classes.get(s.obj.a.name);
      const offset : IR.Value<Type> = { tag: "wasmint", value: classdata.get(s.field)[0] };
      pushStmtsToLastBlock(blocks,
        ...ostmts, ...nstmts, {
          tag: "store",
          a: s.a,
          start: oval,
          offset: offset,
          value: nval
        });
      return [...oinits, ...ninits];
    }
      // return [[...oinits, ...ninits], [...ostmts, ...nstmts, {
      //   tag: "field-assign",
      //   a: s.a,
      //   obj: oval,
      //   field: s.field,
      //   value: nval
      // }]];

    case "if":
      var allInits : Array<IR.VarInit<Type>> = [];
      var endLbls : string[] = [];
      s.conds.forEach((cond, ind) => {
        const curBody = s.bodies[ind];
        var thenLbl = generateName("$then")
        var elseLbl = generateName("$else")
        var endLbl = generateName("$end")
        endLbls.push(endLbl);
        var endjmp : IR.Stmt<Type> = { tag: "jmp", lbl: endLbl };
        var [cinits, cstmts, cexpr] = flattenExprToVal(cond, env);
        allInits.push(...cinits);
        var condjmp : IR.Stmt<Type> = { tag: "ifjmp", cond: cexpr, thn: thenLbl, els: elseLbl };
        pushStmtsToLastBlock(blocks, ...cstmts, condjmp);
        blocks.push({  a: s.a, label: thenLbl, stmts: [] })
        var theninits = flattenStmts(curBody, blocks, env);
        allInits.push(...theninits);
        pushStmtsToLastBlock(blocks, endjmp);
        blocks.push({  a: s.a, label: elseLbl, stmts: [] })
      });
      var elseinits = flattenStmts(s.els, blocks, env);
      for (var i = endLbls.length - 1; i >= 0; --i) {
        pushStmtsToLastBlock(blocks, { tag: "jmp", lbl: endLbls[i] });
        blocks.push({  a: s.a, label: endLbls[i], stmts: [] })
      }
      return [...allInits, ...elseinits]

      // return [[...cinits, ...theninits, ...elseinits], [
      //   ...cstmts, 
      //   condjmp,
      //   startlbl,
      //   ...thenstmts,
      //   endjmp,
      //   elslbl,
      //   ...elsestmts,
      //   endjmp,
      //   endlbl,
      // ]];
    
    case "for":
      var forStartLbl = generateName("$forstart");
      var forbodyLbl = generateName("$forbody");
      var forEndLbl = generateName("$forend");

      // create a new var i for loop iteration indices
      var newName = generateName("forloopind");
      var setNewName : IR.Stmt<Type> = {
        tag: "assign",
        a: NONE,
        name: newName,
        value: { a: NUM, tag: "value", value: { tag: "wasmint", value: 0 } } 
      };
      pushStmtsToLastBlock(blocks, setNewName);
      pushStmtsToLastBlock(blocks, { tag: "jmp", lbl: forStartLbl });

      // for loop condition
      blocks.push({  a: s.a, label: forStartLbl, stmts: [] });
      var [cinits, cstmts, cexpr] =
        flattenExprToVal({ a: BOOL, tag: "binop", op: AST.BinOp.Lt,
          left: {  a: NUM, tag: "id", name: newName }, right: { a: NUM, tag: "builtin1", name: "len", arg: s.iterable} }, env);
      pushStmtsToLastBlock(blocks, ...cstmts, { tag: "ifjmp", cond: cexpr, thn: forbodyLbl, els: forEndLbl });

      // for loop body preparation
      blocks.push({  a: s.a, label: forbodyLbl, stmts: [] });
      var [itvinits, itvstmts, itvval] = flattenExprToVal(s.itvar, env);
      if (itvval.tag !== "id") throw new Error("For loop variable cannot be literal");
      var [itbinits, itbstmts, itbval] = flattenExprToVal(s.iterable, env);
      pushStmtsToLastBlock(blocks, ...itvstmts, ...itbstmts);
      // assign itvval to itbval[newName]
      pushStmtsToLastBlock(blocks, { tag: "assign", a: NONE, name: itvval.name,
        value: { tag: "load", start: itbval, list: true, offset: { a: NUM, tag: "id", name: newName } } });
      
      // body statement
      var bodyinits = flattenStmts(s.body, blocks, env);
      pushStmtsToLastBlock(blocks, { tag: "assign", a: NONE, name: newName,
        value: {a: NUM, tag: "binop", op: AST.BinOp.Plus, left: { a: NUM, tag: "id", name: newName },
          right: { a: NUM, tag: "wasmint", value: 1 } } }) // ind = ind + 1
      pushStmtsToLastBlock(blocks, { tag: "jmp", lbl: forStartLbl });

      blocks.push({  a: s.a, label: forEndLbl, stmts: [] })

      return [...itbinits, ...itvinits, ...cinits, ...bodyinits, { a: s.a, name: newName, type: s.a, value: { tag: "none" } }];

    case "while":
      var whileStartLbl = generateName("$whilestart");
      var whilebodyLbl = generateName("$whilebody");
      var whileEndLbl = generateName("$whileend");

      pushStmtsToLastBlock(blocks, { tag: "jmp", lbl: whileStartLbl })
      blocks.push({  a: s.a, label: whileStartLbl, stmts: [] })
      var [cinits, cstmts, cexpr] = flattenExprToVal(s.cond, env);
      pushStmtsToLastBlock(blocks, ...cstmts, { tag: "ifjmp", cond: cexpr, thn: whilebodyLbl, els: whileEndLbl });

      blocks.push({  a: s.a, label: whilebodyLbl, stmts: [] })
      var bodyinits = flattenStmts(s.body, blocks, env);
      pushStmtsToLastBlock(blocks, { tag: "jmp", lbl: whileStartLbl });

      blocks.push({  a: s.a, label: whileEndLbl, stmts: [] })

      return [...cinits, ...bodyinits]
  }
}

function flattenExprToExpr(e : AST.Expr<Type>, env : GlobalEnv) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>, IR.Expr<Type>] {
  switch(e.tag) {
    case "uniop":
      var [inits, stmts, val] = flattenExprToVal(e.expr, env);
      return [inits, stmts, {
        ...e,
        expr: val
      }];
    case "binop":
      var [linits, lstmts, lval] = flattenExprToVal(e.left, env);
      var [rinits, rstmts, rval] = flattenExprToVal(e.right, env);
      return [[...linits, ...rinits], [...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "builtin1":
      var [inits, stmts, val] = flattenExprToVal(e.arg, env);
      if (e.name === "len") {
        const checkObj : IR.Stmt<Type> = { tag: "expr", expr: { tag: "call", name: `assert_not_none`, arguments: [val]}}
        return [inits, [...stmts, checkObj], {tag: "builtin1", a: e.a, name: e.name, arg: val}];
      }
      return [inits, stmts, {tag: "builtin1", a: e.a, name: e.name, arg: val}];
    case "builtin2":
      var [linits, lstmts, lval] = flattenExprToVal(e.left, env);
      var [rinits, rstmts, rval] = flattenExprToVal(e.right, env);
      return [[...linits, ...rinits], [...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "call":
      const callpairs = e.arguments.map(a => flattenExprToVal(a, env));
      const callinits = callpairs.map(cp => cp[0]).flat();
      const callstmts = callpairs.map(cp => cp[1]).flat();
      const callvals = callpairs.map(cp => cp[2]).flat();
      return [ callinits, callstmts,
        {
          ...e,
          arguments: callvals
        }
      ];
    case "method-call": {
      const [objinits, objstmts, objval] = flattenExprToVal(e.obj, env);
      const argpairs = e.arguments.map(a => flattenExprToVal(a, env));
      const arginits = argpairs.map(cp => cp[0]).flat();
      const argstmts = argpairs.map(cp => cp[1]).flat();
      const argvals = argpairs.map(cp => cp[2]).flat();
      var objTyp = e.obj.a;
      if(objTyp.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag);
      }
      const className = objTyp.name;
      const checkObj : IR.Stmt<Type> = { tag: "expr", expr: { tag: "call", name: `assert_not_none`, arguments: [objval]}}
      const callMethod : IR.Expr<Type> = { tag: "call", name: `${className}$${e.method}`, arguments: [objval, ...argvals] }
      return [
        [...objinits, ...arginits],
        [...objstmts, checkObj, ...argstmts],
        callMethod
      ];
    }
    case "lookup": {
      const [oinits, ostmts, oval] = flattenExprToVal(e.obj, env);
      if(e.obj.a.tag !== "class") { throw new Error("Compiler's cursed, go home"); }
      const classdata = env.classes.get(e.obj.a.name);
      const [offset, _] = classdata.get(e.field);
      return [oinits, ostmts, {
        tag: "load",
        start: oval,
        list: false,
        offset: { tag: "wasmint", value: offset }}];
    }
    case "access": {
      const [linits, lstmts, lval] = flattenExprToVal(e.obj, env);
      if(e.obj.a.tag !== "list") { throw new Error("Compiler's cursed, go home"); }
      const [vinits, vstmts, vval] = flattenExprToVal(e.ind, env);
      return [
        [...linits, ...vinits], [...lstmts, ...vstmts], {
          tag: "load",
          start: lval,
          list: true,
          offset: vval
        }
      ];
    }
    case "array": {
      const arrayName = generateName("newList");
      const alloc : IR.Expr<Type> = { tag: "alloc", amount: { tag: "wasmint", value: e.length + 1 } }
      var linits : IR.VarInit<Type>[] = [];
      var lstmts : IR.Stmt<Type>[] = [];
      const assigns : IR.Stmt<Type>[] = [];
      assigns.push({
        tag: "store",
        start: { tag: "id", name: arrayName },
        offset: { tag: "wasmint", value: 0 },
        value: { tag: "wasmint", value: e.length }
      });
      e.elems.forEach((elem, ind) => {
        const [linit, lstmt, lval] = flattenExprToVal(elem, env);
        linits = linits.concat(linit);
        lstmts = lstmts.concat(lstmt);
        assigns.push({
          tag: "store",
          start: { tag: "id", name: arrayName },
          offset: { tag: "wasmint", value: ind + 1 },
          value: lval
        })
      });
      return [
        [...linits, { name: arrayName, type: e.a, value: { tag: "none" } }],
        [...lstmts, { tag: "assign", name: arrayName, value: alloc }, ...assigns],
        { a: e.a, tag: "value", value: { a: e.a, tag: "id", name: arrayName } }
      ]
    }
    case "construct":
      const classdata = env.classes.get(e.name);
      const fields = [...classdata.entries()];
      const newName = generateName("newObj");
      const alloc : IR.Expr<Type> = { tag: "alloc", amount: { tag: "wasmint", value: fields.length } };
      const assigns : IR.Stmt<Type>[] = fields.map(f => {
        const [_, [index, value]] = f;
        return {
          tag: "store",
          start: { tag: "id", name: newName },
          offset: { tag: "wasmint", value: index },
          value: value
        }
      });

      return [
        [ { name: newName, type: e.a, value: { tag: "none" } }],
        [ { tag: "assign", name: newName, value: alloc }, ...assigns,
          { tag: "expr", expr: { tag: "call", name: `${e.name}$__init__`, arguments: [{ a: e.a, tag: "id", name: newName }] } }
        ],
        { a: e.a, tag: "value", value: { a: e.a, tag: "id", name: newName } }
      ];
    case "id":
      return [[], [], {tag: "value", value: { ...e }} ];
    case "literal":
      return [[], [], {tag: "value", value: literalToVal(e.value) } ];
  }
}

function flattenExprToVal(e : AST.Expr<Type>, env : GlobalEnv) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>, IR.Value<Type>] {
  var [binits, bstmts, bexpr] = flattenExprToExpr(e, env);
  if(bexpr.tag === "value") {
    return [binits, bstmts, bexpr.value];
  }
  else {
    var newName = generateName("valname");
    var setNewName : IR.Stmt<Type> = {
      tag: "assign",
      a: e.a,
      name: newName,
      value: bexpr 
    };
    // TODO: we have to add a new var init for the new variable we're creating here.
    // but what should the default value be?
    return [
      [...binits, { a: e.a, name: newName, type: e.a, value: { tag: "none" } }],
      [...bstmts, setNewName],  
      {tag: "id", name: newName, a: e.a}
    ];
  }
}

function pushStmtsToLastBlock(blocks: Array<IR.BasicBlock<Type>>, ...stmts: Array<IR.Stmt<Type>>) {
  blocks[blocks.length - 1].stmts.push(...stmts);
}