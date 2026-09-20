import { parseA1 } from "../model/cell-key.js";

export type Token =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "ref"; value: string }
  | { kind: "range"; start: string; end: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "colon" }
  | { kind: "eof" };

export function tokenize(input: string): Token[] {
  let s = input.trim();
  if (s.startsWith("=")) s = s.slice(1);
  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    if (ch === ":") {
      tokens.push({ kind: "colon" });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = "";
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) {
          str += s[i + 1];
          i += 2;
        } else {
          str += s[i++];
        }
      }
      i++; // closing quote
      tokens.push({ kind: "string", value: str });
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ kind: "number", value: Number(num) });
      continue;
    }
    if (/[A-Za-z$]/.test(ch)) {
      let id = "";
      while (i < s.length && /[A-Za-z0-9_$]/.test(s[i])) id += s[i++];
      // Lookahead for range A1:B2
      if (/^\$?[A-Za-z]+\$?\d+$/.test(id)) {
        tokens.push({ kind: "ref", value: id });
      } else {
        tokens.push({ kind: "ident", value: id.toUpperCase() });
      }
      continue;
    }
    if ("+-*/^<>=&%".includes(ch)) {
      let op = ch;
      i++;
      if (
        (ch === "<" || ch === ">" || ch === "=") &&
        i < s.length &&
        "=>=".includes(s[i])
      ) {
        if (ch === "<" && (s[i] === "=" || s[i] === ">")) op += s[i++];
        else if (ch === ">" && s[i] === "=") op += s[i++];
        else if (ch === "=" && s[i] === "=") op += s[i++];
      }
      tokens.push({ kind: "op", value: op });
      continue;
    }
    throw new Error(`Unexpected character: ${ch} at ${i}`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

export type AstNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "ref"; row: number; col: number; raw: string }
  | { type: "range"; r1: number; c1: number; r2: number; c2: number; raw: string }
  | { type: "call"; name: string; args: AstNode[] }
  | { type: "unary"; op: string; arg: AstNode }
  | { type: "binary"; op: string; left: AstNode; right: AstNode };

export class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  static parse(input: string): AstNode {
    const p = new Parser(tokenize(input));
    const node = p.parseExpr();
    p.expect("eof");
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: "eof" };
  }

  private next(): Token {
    return this.tokens[this.pos++] ?? { kind: "eof" };
  }

  private expect(kind: Token["kind"]): Token {
    const t = this.next();
    if (t.kind !== kind) throw new Error(`Expected ${kind}, got ${t.kind}`);
    return t;
  }

  private parseExpr(): AstNode {
    return this.parseCompare();
  }

  private parseCompare(): AstNode {
    let left = this.parseAdd();
    while (this.peek().kind === "op" && ["<", ">", "<=", ">=", "=", "==", "<>"].includes((this.peek() as { value: string }).value)) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseAdd();
      left = { type: "binary", op: op === "==" ? "=" : op, left, right };
    }
    return left;
  }

  private parseAdd(): AstNode {
    let left = this.parseMul();
    while (
      this.peek().kind === "op" &&
      ["+", "-", "&"].includes((this.peek() as { value: string }).value)
    ) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseMul();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseMul(): AstNode {
    let left = this.parseUnary();
    while (
      this.peek().kind === "op" &&
      ["*", "/"].includes((this.peek() as { value: string }).value)
    ) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseUnary();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek().kind === "op" && (this.peek() as { value: string }).value === "-") {
      this.next();
      return { type: "unary", op: "-", arg: this.parseUnary() };
    }
    if (this.peek().kind === "op" && (this.peek() as { value: string }).value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const t = this.peek();
    if (t.kind === "number") {
      this.next();
      return { type: "number", value: t.value };
    }
    if (t.kind === "string") {
      this.next();
      return { type: "string", value: t.value };
    }
    if (t.kind === "ref") {
      this.next();
      // range?
      if (this.peek().kind === "colon") {
        this.next();
        const endTok = this.expect("ref") as Extract<Token, { kind: "ref" }>;
        const a = parseA1(t.value);
        const b = parseA1(endTok.value);
        return {
          type: "range",
          r1: Math.min(a.row, b.row),
          c1: Math.min(a.col, b.col),
          r2: Math.max(a.row, b.row),
          c2: Math.max(a.col, b.col),
          raw: `${t.value}:${endTok.value}`,
        };
      }
      const a = parseA1(t.value);
      return { type: "ref", row: a.row, col: a.col, raw: t.value };
    }
    if (t.kind === "ident") {
      this.next();
      if (t.value === "TRUE") return { type: "bool", value: true };
      if (t.value === "FALSE") return { type: "bool", value: false };
      this.expect("lparen");
      const args: AstNode[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.parseExpr());
        while (this.peek().kind === "comma") {
          this.next();
          args.push(this.parseExpr());
        }
      }
      this.expect("rparen");
      return { type: "call", name: t.value, args };
    }
    if (t.kind === "lparen") {
      this.next();
      const n = this.parseExpr();
      this.expect("rparen");
      return n;
    }
    throw new Error(`Unexpected token: ${t.kind}`);
  }
}

/** Collect cell refs used by an AST (for dependency tracking) */
export function collectRefs(
  node: AstNode,
  out: Array<{ row: number; col: number }> = [],
): Array<{ row: number; col: number }> {
  switch (node.type) {
    case "ref":
      out.push({ row: node.row, col: node.col });
      break;
    case "range":
      for (let r = node.r1; r <= node.r2; r++) {
        for (let c = node.c1; c <= node.c2; c++) {
          out.push({ row: r, col: c });
        }
      }
      break;
    case "unary":
      collectRefs(node.arg, out);
      break;
    case "binary":
      collectRefs(node.left, out);
      collectRefs(node.right, out);
      break;
    case "call":
      for (const a of node.args) collectRefs(a, out);
      break;
  }
  return out;
}
