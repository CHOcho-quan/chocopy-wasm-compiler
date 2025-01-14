import {Type, BinOp, UniOp, Parameter} from './ast';

export type Program<A> = { a?: A, funs: Array<FunDef<A>>, inits: Array<VarInit<A>>, classes: Array<Class<A>>, body: Array<BasicBlock<A>>, table?: Array<ClassIndex<A>> }

export type ClassIndex<A> = {a?: A, classname: string, fields: Array<string>, methods: Array<string>, methodClass: Array<string>, methodType: Array<string>, methodParam: Array<[number, boolean]>, children: Array<ClassIndex<A>> }

export type Class<A> = { a?: A, name: string, fields: Array<VarInit<A>>, methods: Array<FunDef<A>>}

export type VarInit<A> = { a?: A, name: string, type: Type, value: Value<A> }

export type FunDef<A> = { a?: A, name: string, parameters: Array<Parameter<A>>, ret: Type, inits: Array<VarInit<A>>, body: Array<BasicBlock<A>>, nest: boolean, class?: string }

export type BasicBlock<A> = 
| {  a?: A, label: string, stmts: Array<Stmt<A>> }

export type Stmt<A> =
  | {  a?: A, tag: "assign", name: string, value: Expr<A> }
  | {  a?: A, tag: "return", value: Value<A> }
  | {  a?: A, tag: "expr", expr: Expr<A> }
  | {  a?: A, tag: "pass" }
  | {  a?: A, tag: "ifjmp", cond: Value<A>, thn: string, els: string }
  | {  a?: A, tag: "jmp", lbl: string }
  | {  a?: A, tag: "store", start: Value<A>, offset: Value<A>, value: Value<A> } // start should be an id

export type Expr<A> =
  | {  a?: A, tag: "value", value: Value<A> }
  | {  a?: A, tag: "binop", op: BinOp, left: Value<A>, right: Value<A>}
  | {  a?: A, tag: "uniop", op: UniOp, expr: Value<A> }
  | {  a?: A, tag: "builtin1", name: string, arg: Value<A> }
  | {  a?: A, tag: "builtin2", name: string, left: Value<A>, right: Value<A>}
  | {  a?: A, tag: "call", name: string, arguments: Array<Value<A>> } 
  | {  a?: A, tag: "methodcall", name: string, arguments: Array<Value<A>>, class: string }
  | {  a?: A, tag: "alloc", amount: Value<A> }
  | {  a?: A, tag: "load", start: Value<A>, offset: Value<A>, list: boolean }

export type Value<A> = 
    { a?: A, tag: "num", value: bigint }
  | { a?: A, tag: "wasmint", value: number }
  | { a?: A, tag: "str", value: string }
  | { a?: A, tag: "bool", value: boolean }
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "none" }


