// import { TypeCheckError } from "./type-check";

// export enum Type {NUM, BOOL, NONE, OBJ}; 
export type Type =
  | {tag: "number"}
  | {tag: "bool"}
  | {tag: "none"}
  | {tag: "str"}
  | {tag: "empty"}
  | {tag: "list", elem: Type}
  | {tag: "class", name: string}
  | {tag: "either", left: Type, right: Type }

export type Parameter<A> = { name: string, type: Type, nonlocal: boolean }

export type Program<A> = { a?: A, funs: Array<FunDef<A>>, inits: Array<VarInit<A>>, classes: Array<Class<A>>, stmts: Array<Stmt<A>>, table?: Array<ClassIndex<A>> }

export type ClassIndex<A> = {a?: A, classname: string, fields: Array<string>, methods: Array<string>, methodClass: Array<string>, methodType: Array<string>, methodParam: Array<[number, boolean]>, children: Array<ClassIndex<A>> }

export type Class<A> = { a?: A, name: string, fields: Array<VarInit<A>>, methods: Array<FunDef<A>>, parent?: string}

export type VarInit<A> = { a?: A, name: string, type: Type, value: Literal }

export type FunDef<A> = { a?: A, name: string, parameters: Array<Parameter<A>>, ret: Type, inits: Array<VarInit<A>>, nested: Array<FunDef<A>>, body: Array<Stmt<A>>, class?: string }

export type Stmt<A> =
  | {  a?: A, tag: "assign", name: string, value: Expr<A> }
  | {  a?: A, tag: "scope", name: string }
  | {  a?: A, tag: "comment" }
  | {  a?: A, tag: "return", value: Expr<A> }
  | {  a?: A, tag: "expr", expr: Expr<A> }
  | {  a?: A, tag: "pass" }
  | {  a?: A, tag: "field-assign", obj: Expr<A>, field: string, value: Expr<A> }
  | {  a?: A, tag: "if", conds: Array<Expr<A>>, bodies: Array<Stmt<A>[]>, els: Array<Stmt<A>> }
  | {  a?: A, tag: "for", itvar: Expr<A>, iterable: Expr<A>, body: Array<Stmt<A>> }
  | {  a?: A, tag: "while", cond: Expr<A>, body: Array<Stmt<A>> }

export type Expr<A> =
    {  a?: A, tag: "literal", value: Literal }
  | {  a?: A, tag: "id", name: string }
  | {  a?: A, tag: "binop", op: BinOp, left: Expr<A>, right: Expr<A>}
  | {  a?: A, tag: "uniop", op: UniOp, expr: Expr<A> }
  | {  a?: A, tag: "builtin1", name: string, arg: Expr<A> }
  | {  a?: A, tag: "builtin2", name: string, left: Expr<A>, right: Expr<A>}
  | {  a?: A, tag: "call", name: string, arguments: Array<Expr<A>> } 
  | {  a?: A, tag: "lookup", obj: Expr<A>, field: string }
  | {  a?: A, tag: "access", obj: Expr<A>, ind: Expr<A> }
  | {  a?: A, tag: "array", length: number, elems: Array<Expr<A>>}
  | {  a?: A, tag: "method-call", obj: Expr<A>, method: string, arguments: Array<Expr<A>> }
  | {  a?: A, tag: "construct", name: string }

export type Literal = 
    { tag: "num", value: number }
  | { tag: "bool", value: boolean }
  | { tag: "str", value: string }
  | { tag: "none" }

// TODO: should we split up arithmetic ops from bool ops?
export enum BinOp { Plus, IterPlus, Minus, Mul, IDiv, Mod, Eq, Neq, Lte, Gte, Lt, Gt, Is, And, Or};

export enum UniOp { Neg, Not };

export type Value =
    Literal
  | { tag: "object", name: string, address: number}
