/**
 * Chess AI — Minimax with Alpha-Beta Pruning
 * Piece-Square Tables from Chessprogramming Wiki (Simplified Evaluation)
 * Depth 3 → ~100ms on mobile, depth 4 → ~800ms
 */

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type Color = 'white' | 'black';
interface Piece { type: PieceType; color: Color; }
type Board = (Piece | null)[][];
interface CastlingRights { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean; }

// ─── Material values ──────────────────────────────────────────────────────────

const MATERIAL: Record<PieceType, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
};

// ─── Piece-Square Tables (white's perspective, flip for black) ────────────────
// Source: Simplified Evaluation Function — chessprogramming.org

const PST_P = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [ 5,  5, 10, 25, 25, 10,  5,  5],
  [ 0,  0,  0, 20, 20,  0,  0,  0],
  [ 5, -5,-10,  0,  0,-10, -5,  5],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];
const PST_N = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];
const PST_B = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];
const PST_R = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [ 0,  0,  0,  5,  5,  0,  0,  0],
];
const PST_Q = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
];
const PST_K_MID = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20],
];

const PST_MAP: Record<PieceType, number[][]> = {
  P: PST_P, N: PST_N, B: PST_B, R: PST_R, Q: PST_Q, K: PST_K_MID,
};

// ─── Evaluation ───────────────────────────────────────────────────────────────

function getPSTValue(type: PieceType, color: Color, row: number, col: number): number {
  const table = PST_MAP[type];
  const r = color === 'white' ? row : 7 - row;
  return table[r][col];
}

export function evaluateBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = MATERIAL[p.type] + getPSTValue(p.type, p.color, r, c);
      score += p.color === 'white' ? val : -val;
    }
  }
  return score;
}

// ─── Move generation (re-exported from ChessGame logic) ───────────────────────
// We duplicate a minimal version here to keep this file self-contained.

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getRawMoves(board: Board, row: number, col: number, ep: [number,number]|null): [number,number][] {
  const piece = board[row][col];
  if (!piece) return [];
  const { type, color } = piece;
  const opp: Color = color === 'white' ? 'black' : 'white';
  const moves: [number,number][] = [];

  const isEmpty = (r:number,c:number) => inBounds(r,c) && board[r][c] === null;
  const isOpp   = (r:number,c:number) => inBounds(r,c) && board[r][c]?.color === opp;
  const isFriend= (r:number,c:number) => inBounds(r,c) && board[r][c]?.color === color;

  const slide = (dr:number, dc:number) => {
    let r = row+dr, c = col+dc;
    while (inBounds(r,c)) {
      if (isFriend(r,c)) break;
      moves.push([r,c]);
      if (isOpp(r,c)) break;
      r+=dr; c+=dc;
    }
  };

  if (type === 'P') {
    const dir = color === 'white' ? -1 : 1;
    const start = color === 'white' ? 6 : 1;
    if (isEmpty(row+dir, col)) {
      moves.push([row+dir, col]);
      if (row === start && isEmpty(row+2*dir, col)) moves.push([row+2*dir, col]);
    }
    for (const dc of [-1,1]) {
      if (isOpp(row+dir, col+dc)) moves.push([row+dir, col+dc]);
      if (ep && row+dir === ep[0] && col+dc === ep[1]) moves.push([row+dir, col+dc]);
    }
  } else if (type === 'N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as [number,number][]) {
      const r=row+dr,c=col+dc;
      if (inBounds(r,c) && !isFriend(r,c)) moves.push([r,c]);
    }
  } else if (type === 'B') { slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1); }
  else if (type === 'R') { slide(-1,0);slide(1,0);slide(0,-1);slide(0,1); }
  else if (type === 'Q') { slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1);slide(-1,0);slide(1,0);slide(0,-1);slide(0,1); }
  else if (type === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as [number,number][]) {
      const r=row+dr,c=col+dc;
      if (inBounds(r,c) && !isFriend(r,c)) moves.push([r,c]);
    }
  }
  return moves;
}

function isInCheck(board: Board, color: Color): boolean {
  let kr=-1, kc=-1;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p=board[r][c];
    if (p?.color===color && p.type==='K') { kr=r; kc=c; }
  }
  if (kr<0) return false;
  const opp: Color = color==='white'?'black':'white';
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p=board[r][c];
    if (p?.color===opp) {
      if (getRawMoves(board,r,c,null).some(([mr,mc])=>mr===kr&&mc===kc)) return true;
    }
  }
  return false;
}

interface AIMove { fromRow:number; fromCol:number; toRow:number; toCol:number; }

function getAllMoves(board: Board, color: Color, ep: [number,number]|null, castling: CastlingRights): AIMove[] {
  const moves: AIMove[] = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (!p || p.color !== color) continue;
    const raw = getRawMoves(board, r, c, ep);
    for (const [tr,tc] of raw) {
      const nb = cloneBoard(board);
      nb[tr][tc] = nb[r][c];
      nb[r][c] = null;
      if (p.type==='P' && (tr===0||tr===7)) nb[tr][tc] = {type:'Q',color};
      if (!isInCheck(nb, color)) moves.push({fromRow:r,fromCol:c,toRow:tr,toCol:tc});
    }
    // Castling
    if (p.type==='K' && !isInCheck(board,color)) {
      const back = color==='white'?7:0;
      if (r===back && c===4) {
        const ks = color==='white'?castling.wK:castling.bK;
        const qs = color==='white'?castling.wQ:castling.bQ;
        if (ks && !board[back][5] && !board[back][6] && board[back][7]?.type==='R') {
          const nb1=cloneBoard(board); nb1[back][5]=nb1[back][4]; nb1[back][4]=null;
          const nb2=cloneBoard(board); nb2[back][6]=nb2[back][4]; nb2[back][4]=null;
          if (!isInCheck(nb1,color)&&!isInCheck(nb2,color)) moves.push({fromRow:back,fromCol:4,toRow:back,toCol:6});
        }
        if (qs && !board[back][3] && !board[back][2] && !board[back][1] && board[back][0]?.type==='R') {
          const nb1=cloneBoard(board); nb1[back][3]=nb1[back][4]; nb1[back][4]=null;
          const nb2=cloneBoard(board); nb2[back][2]=nb2[back][4]; nb2[back][4]=null;
          if (!isInCheck(nb1,color)&&!isInCheck(nb2,color)) moves.push({fromRow:back,fromCol:4,toRow:back,toCol:2});
        }
      }
    }
  }
  return moves;
}

function applyMove(board: Board, move: AIMove, color: Color): Board {
  const nb = cloneBoard(board);
  const p = nb[move.fromRow][move.fromCol]!;
  nb[move.toRow][move.toCol] = p;
  nb[move.fromRow][move.fromCol] = null;
  if (p.type==='P' && (move.toRow===0||move.toRow===7)) nb[move.toRow][move.toCol]={type:'Q',color};
  const back = color==='white'?7:0;
  if (p.type==='K' && move.fromCol===4) {
    if (move.toCol===6) { nb[back][5]=nb[back][7]; nb[back][7]=null; }
    if (move.toCol===2) { nb[back][3]=nb[back][0]; nb[back][0]=null; }
  }
  return nb;
}

// ─── Minimax with Alpha-Beta Pruning ─────────────────────────────────────────

function minimax(
  board: Board, depth: number, alpha: number, beta: number,
  maximizing: boolean, ep: [number,number]|null, castling: CastlingRights,
): number {
  if (depth === 0) return evaluateBoard(board);

  const color: Color = maximizing ? 'white' : 'black';
  const moves = getAllMoves(board, color, ep, castling);

  if (moves.length === 0) {
    if (isInCheck(board, color)) return maximizing ? -99999 : 99999;
    return 0; // stalemate
  }

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const nb = applyMove(board, move, color);
      const val = minimax(nb, depth-1, alpha, beta, false, null, castling);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break; // β cut-off
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const nb = applyMove(board, move, color);
      const val = minimax(nb, depth-1, alpha, beta, true, null, castling);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break; // α cut-off
    }
    return best;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getBestMove(
  board: Board,
  aiColor: Color,
  castling: CastlingRights,
  ep: [number,number]|null,
  depth = 3,
): AIMove | null {
  const moves = getAllMoves(board, aiColor, ep, castling);
  if (moves.length === 0) return null;

  const maximizing = aiColor === 'white';
  let bestMove = moves[0];
  let bestVal = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const nb = applyMove(board, move, aiColor);
    const val = minimax(nb, depth-1, -Infinity, Infinity, !maximizing, null, castling);
    if (maximizing ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }
  return bestMove;
}
