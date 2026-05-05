import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList } from '../../types';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { gameSounds } from '../../services/gameSounds';

// ─── Types ────────────────────────────────────────────────────────────────────

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type Color = 'white' | 'black';

interface Piece {
  type: PieceType;
  color: Color;
}

type Board = (Piece | null)[][];

interface CastlingRights {
  wK: boolean; // white kingside
  wQ: boolean; // white queenside
  bK: boolean; // black kingside
  bQ: boolean; // black queenside
}

type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'ChessGame'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: screenWidth } = Dimensions.get('window');
const BOARD_SIZE = screenWidth - 32;
const SQUARE_SIZE = BOARD_SIZE / 8;
const FONT_SIZE = SQUARE_SIZE * 0.7;

const LIGHT_SQUARE = '#F0D9B5';
const DARK_SQUARE = '#B58863';
const SELECTED_COLOR = 'rgba(20,200,20,0.4)';
const VALID_MOVE_COLOR = 'rgba(20,200,20,0.3)';
const LAST_MOVE_COLOR = 'rgba(255,200,0,0.35)';
const CHECK_COLOR = 'rgba(255,0,0,0.4)';

const WHITE_PIECES: Record<PieceType, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
};
const BLACK_PIECES: Record<PieceType, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
};

const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// ─── Board Initialization ─────────────────────────────────────────────────────

function initBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

  // Black back rank (row 0)
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: backRank[c], color: 'black' };
  }
  // Black pawns (row 1)
  for (let c = 0; c < 8; c++) {
    b[1][c] = { type: 'P', color: 'black' };
  }
  // White pawns (row 6)
  for (let c = 0; c < 8; c++) {
    b[6][c] = { type: 'P', color: 'white' };
  }
  // White back rank (row 7)
  for (let c = 0; c < 8; c++) {
    b[7][c] = { type: backRank[c], color: 'white' };
  }

  return b;
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

// ─── Check Detection ──────────────────────────────────────────────────────────

function isInCheck(board: Board, color: Color): boolean {
  // Find king position
  let kingRow = -1;
  let kingCol = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'K') {
        kingRow = r;
        kingCol = c;
      }
    }
  }
  if (kingRow === -1) return false;

  const opp: Color = color === 'white' ? 'black' : 'white';

  // Check if any opponent piece attacks the king
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === opp) {
        const attacks = getRawMoves(board, r, c, null);
        if (attacks.some(([mr, mc]) => mr === kingRow && mc === kingCol)) {
          return true;
        }
      }
    }
  }
  return false;
}

// ─── Raw Moves (no check filtering, no castling, no en passant for attack check) ──

function getRawMoves(
  board: Board,
  row: number,
  col: number,
  enPassantTarget: [number, number] | null,
): [number, number][] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: [number, number][] = [];
  const { type, color } = piece;
  const opp: Color = color === 'white' ? 'black' : 'white';

  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const isEmpty = (r: number, c: number) => inBounds(r, c) && board[r][c] === null;
  const isOpponent = (r: number, c: number) => inBounds(r, c) && board[r][c] !== null && board[r][c]!.color === opp;
  const isFriendly = (r: number, c: number) => inBounds(r, c) && board[r][c] !== null && board[r][c]!.color === color;

  const slide = (dr: number, dc: number) => {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      if (isFriendly(r, c)) break;
      moves.push([r, c]);
      if (isOpponent(r, c)) break;
      r += dr;
      c += dc;
    }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;

      // Forward one
      if (isEmpty(row + dir, col)) {
        moves.push([row + dir, col]);
        // Forward two from start
        if (row === startRow && isEmpty(row + 2 * dir, col)) {
          moves.push([row + 2 * dir, col]);
        }
      }
      // Diagonal captures
      for (const dc of [-1, 1]) {
        if (isOpponent(row + dir, col + dc)) {
          moves.push([row + dir, col + dc]);
        }
        // En passant
        if (
          enPassantTarget &&
          row + dir === enPassantTarget[0] &&
          col + dc === enPassantTarget[1]
        ) {
          moves.push([row + dir, col + dc]);
        }
      }
      break;
    }

    case 'N': {
      const knightMoves: [number, number][] = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of knightMoves) {
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && !isFriendly(r, c)) {
          moves.push([r, c]);
        }
      }
      break;
    }

    case 'B': {
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      break;
    }

    case 'R': {
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      break;
    }

    case 'Q': {
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      break;
    }

    case 'K': {
      const kingMoves: [number, number][] = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],            [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];
      for (const [dr, dc] of kingMoves) {
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && !isFriendly(r, c)) {
          moves.push([r, c]);
        }
      }
      break;
    }
  }

  return moves;
}

// ─── Valid Moves (with check filtering + castling + en passant) ───────────────

function getValidMoves(
  board: Board,
  row: number,
  col: number,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: [number, number] | null,
): [number, number][] {
  const piece = board[row][col];
  if (!piece || piece.color !== color) return [];

  const rawMoves = getRawMoves(board, row, col, enPassantTarget);

  // Filter moves that leave own king in check
  const legalMoves = rawMoves.filter(([toR, toC]) => {
    const newBoard = cloneBoard(board);

    // En passant capture: remove the captured pawn
    if (
      piece.type === 'P' &&
      enPassantTarget &&
      toR === enPassantTarget[0] &&
      toC === enPassantTarget[1] &&
      board[toR][toC] === null
    ) {
      const capturedPawnRow = color === 'white' ? toR + 1 : toR - 1;
      newBoard[capturedPawnRow][toC] = null;
    }

    newBoard[toR][toC] = newBoard[row][col];
    newBoard[row][col] = null;

    // Pawn promotion (for check detection purposes)
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      newBoard[toR][toC] = { type: 'Q', color };
    }

    return !isInCheck(newBoard, color);
  });

  // Castling
  if (piece.type === 'K' && !isInCheck(board, color)) {
    const backRankRow = color === 'white' ? 7 : 0;
    if (row === backRankRow && col === 4) {
      // Kingside
      const ksRight = color === 'white' ? castlingRights.wK : castlingRights.bK;
      if (
        ksRight &&
        board[backRankRow][5] === null &&
        board[backRankRow][6] === null &&
        board[backRankRow][7]?.type === 'R' &&
        board[backRankRow][7]?.color === color
      ) {
        // Check that squares king passes through are not attacked
        const mid1Board = cloneBoard(board);
        mid1Board[backRankRow][5] = mid1Board[backRankRow][4];
        mid1Board[backRankRow][4] = null;
        const mid2Board = cloneBoard(board);
        mid2Board[backRankRow][6] = mid2Board[backRankRow][4];
        mid2Board[backRankRow][4] = null;
        if (!isInCheck(mid1Board, color) && !isInCheck(mid2Board, color)) {
          legalMoves.push([backRankRow, 6]);
        }
      }

      // Queenside
      const qsRight = color === 'white' ? castlingRights.wQ : castlingRights.bQ;
      if (
        qsRight &&
        board[backRankRow][3] === null &&
        board[backRankRow][2] === null &&
        board[backRankRow][1] === null &&
        board[backRankRow][0]?.type === 'R' &&
        board[backRankRow][0]?.color === color
      ) {
        const mid1Board = cloneBoard(board);
        mid1Board[backRankRow][3] = mid1Board[backRankRow][4];
        mid1Board[backRankRow][4] = null;
        const mid2Board = cloneBoard(board);
        mid2Board[backRankRow][2] = mid2Board[backRankRow][4];
        mid2Board[backRankRow][4] = null;
        if (!isInCheck(mid1Board, color) && !isInCheck(mid2Board, color)) {
          legalMoves.push([backRankRow, 2]);
        }
      }
    }
  }

  return legalMoves;
}

function hasLegalMoves(
  board: Board,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: [number, number] | null,
): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const moves = getValidMoves(board, r, c, color, castlingRights, enPassantTarget);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}

// ─── Notation Helpers ─────────────────────────────────────────────────────────

function toAlgebraic(row: number, col: number): string {
  return FILE_LABELS[col] + (8 - row).toString();
}

function buildMoveNotation(
  piece: Piece,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  isCapture: boolean,
  isCastleKingside: boolean,
  isCastleQueenside: boolean,
): string {
  if (isCastleKingside) return 'O-O';
  if (isCastleQueenside) return 'O-O-O';
  const pieceChar = piece.type === 'P' ? '' : piece.type;
  const capture = isCapture ? 'x' : '→';
  const from = toAlgebraic(fromRow, fromCol);
  const to = toAlgebraic(toRow, toCol);
  return `${pieceChar}${from}${capture}${to}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChessGame() {
  const navigation = useNavigation<Nav>();
  const { C } = useTheme();
  const styles = makeStyles(C);

  const [board, setBoard] = useState<Board>(initBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [turn, setTurn] = useState<Color>('white');
  const [capturedWhite, setCapturedWhite] = useState<Piece[]>([]); // captured from white side (taken by black)
  const [capturedBlack, setCapturedBlack] = useState<Piece[]>([]); // captured from black side (taken by white)
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [winner, setWinner] = useState<Color | null>(null);
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [castlingRights, setCastlingRights] = useState<CastlingRights>({
    wK: true, wQ: true, bK: true, bQ: true,
  });
  const [enPassantTarget, setEnPassantTarget] = useState<[number, number] | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const resetGame = useCallback(() => {
    setBoard(initBoard());
    setSelected(null);
    setValidMoves([]);
    setTurn('white');
    setCapturedWhite([]);
    setCapturedBlack([]);
    setGameStatus('playing');
    setWinner(null);
    setLastMove(null);
    setMoveHistory([]);
    setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true });
    setEnPassantTarget(null);
    setShowGameOver(false);
  }, []);

  const handleSquarePress = useCallback((row: number, col: number) => {
    if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;

    const piece = board[row][col];

    // If a piece is already selected
    if (selected) {
      const [selRow, selCol] = selected;

      // Check if the tapped square is a valid move
      const isValid = validMoves.some(([r, c]) => r === row && c === col);

      if (isValid) {
        // Execute the move
        const movingPiece = board[selRow][selCol]!;
        const newBoard = cloneBoard(board);
        const captured = newBoard[row][col];

        // Detect castling
        const isCastleKingside =
          movingPiece.type === 'K' && selCol === 4 && col === 6;
        const isCastleQueenside =
          movingPiece.type === 'K' && selCol === 4 && col === 2;

        // En passant capture
        let epCapturedPiece: Piece | null = null;
        if (
          movingPiece.type === 'P' &&
          enPassantTarget &&
          row === enPassantTarget[0] &&
          col === enPassantTarget[1] &&
          board[row][col] === null
        ) {
          const epPawnRow = turn === 'white' ? row + 1 : row - 1;
          epCapturedPiece = newBoard[epPawnRow][col];
          newBoard[epPawnRow][col] = null;
        }

        // Move piece
        newBoard[row][col] = movingPiece;
        newBoard[selRow][selCol] = null;

        // Castling: move rook
        const backRankRow = turn === 'white' ? 7 : 0;
        if (isCastleKingside) {
          newBoard[backRankRow][5] = newBoard[backRankRow][7];
          newBoard[backRankRow][7] = null;
        }
        if (isCastleQueenside) {
          newBoard[backRankRow][3] = newBoard[backRankRow][0];
          newBoard[backRankRow][0] = null;
        }

        // Pawn promotion — auto-promote to Queen
        if (movingPiece.type === 'P' && (row === 0 || row === 7)) {
          newBoard[row][col] = { type: 'Q', color: turn };
        }

        // Update captured pieces
        const actualCaptured = captured || epCapturedPiece;
        if (actualCaptured) {
          gameSounds.fire('chess_capture');
          if (actualCaptured.color === 'white') {
            setCapturedWhite(prev => [...prev, actualCaptured]);
          } else {
            setCapturedBlack(prev => [...prev, actualCaptured]);
          }
        } else if (isCastleKingside || isCastleQueenside) {
          gameSounds.fire('chess_castle');
        } else {
          gameSounds.fire('chess_move');
        }

        // Update castling rights
        const newCastlingRights = { ...castlingRights };
        if (movingPiece.type === 'K') {
          if (turn === 'white') { newCastlingRights.wK = false; newCastlingRights.wQ = false; }
          else { newCastlingRights.bK = false; newCastlingRights.bQ = false; }
        }
        if (movingPiece.type === 'R') {
          if (turn === 'white') {
            if (selCol === 0) newCastlingRights.wQ = false;
            if (selCol === 7) newCastlingRights.wK = false;
          } else {
            if (selCol === 0) newCastlingRights.bQ = false;
            if (selCol === 7) newCastlingRights.bK = false;
          }
        }
        // If a rook is captured
        if (captured?.type === 'R') {
          if (captured.color === 'white') {
            if (col === 0) newCastlingRights.wQ = false;
            if (col === 7) newCastlingRights.wK = false;
          } else {
            if (col === 0) newCastlingRights.bQ = false;
            if (col === 7) newCastlingRights.bK = false;
          }
        }

        // En passant target for next move
        let newEpTarget: [number, number] | null = null;
        if (movingPiece.type === 'P' && Math.abs(row - selRow) === 2) {
          const epRow = (row + selRow) / 2;
          newEpTarget = [epRow, col];
        }

        // Build move notation
        const notation = buildMoveNotation(
          movingPiece,
          selRow, selCol,
          row, col,
          !!actualCaptured,
          isCastleKingside,
          isCastleQueenside,
        );

        // Determine next turn and game status
        const nextTurn: Color = turn === 'white' ? 'black' : 'white';
        const inCheck = isInCheck(newBoard, nextTurn);
        const hasLegal = hasLegalMoves(newBoard, nextTurn, newCastlingRights, newEpTarget);

        let newStatus: GameStatus = 'playing';
        let newWinner: Color | null = null;

        if (!hasLegal) {
          if (inCheck) {
            newStatus = 'checkmate';
            newWinner = turn;
            gameSounds.fire('win');
          } else {
            newStatus = 'stalemate';
          }
        } else if (inCheck) {
          newStatus = 'check';
          gameSounds.fire('chess_check');
        }

        // Commit all state
        setBoard(newBoard);
        setSelected(null);
        setValidMoves([]);
        setTurn(nextTurn);
        setLastMove({ from: [selRow, selCol], to: [row, col] });
        setMoveHistory(prev => [...prev, notation]);
        setCastlingRights(newCastlingRights);
        setEnPassantTarget(newEpTarget);
        setGameStatus(newStatus);
        setWinner(newWinner);

        if (newStatus === 'checkmate' || newStatus === 'stalemate') {
          setTimeout(() => setShowGameOver(true), 400);
        }

        return;
      }

      // Deselect if same square
      if (selRow === row && selCol === col) {
        setSelected(null);
        setValidMoves([]);
        return;
      }

      // Select a different friendly piece
      if (piece && piece.color === turn) {
        const moves = getValidMoves(board, row, col, turn, castlingRights, enPassantTarget);
        setSelected([row, col]);
        setValidMoves(moves);
        return;
      }

      // Clicked empty or opponent piece not in valid moves — deselect
      setSelected(null);
      setValidMoves([]);
      return;
    }

    // Nothing selected: select a friendly piece
    if (piece && piece.color === turn) {
      const moves = getValidMoves(board, row, col, turn, castlingRights, enPassantTarget);
      setSelected([row, col]);
      setValidMoves(moves);
    }
  }, [board, selected, validMoves, turn, castlingRights, enPassantTarget, gameStatus]);

  // Find king position for check highlight
  const getKingSquare = (): [number, number] | null => {
    if (gameStatus !== 'check' && gameStatus !== 'checkmate') return null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'K' && p.color === turn) return [r, c];
      }
    }
    return null;
  };
  const kingSquare = getKingSquare();

  const renderPiece = (piece: Piece) => {
    const symbol = piece.color === 'white' ? WHITE_PIECES[piece.type] : BLACK_PIECES[piece.type];
    return (
      <Text
        style={[
          styles.pieceText,
          piece.color === 'white' ? styles.whitePiece : styles.blackPiece,
        ]}
      >
        {symbol}
      </Text>
    );
  };

  const renderSquare = (row: number, col: number) => {
    const isLight = (row + col) % 2 === 0;
    const piece = board[row][col];
    const isSelected = selected && selected[0] === row && selected[1] === col;
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    const isLastMoveFrom = lastMove && lastMove.from[0] === row && lastMove.from[1] === col;
    const isLastMoveTo = lastMove && lastMove.to[0] === row && lastMove.to[1] === col;
    const isKingInCheck = kingSquare && kingSquare[0] === row && kingSquare[1] === col;

    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.square,
          { backgroundColor: isLight ? LIGHT_SQUARE : DARK_SQUARE },
        ]}
        onPress={() => handleSquarePress(row, col)}
        activeOpacity={0.85}
      >
        {/* Last move highlight */}
        {(isLastMoveFrom || isLastMoveTo) && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: LAST_MOVE_COLOR }]} />
        )}
        {/* King in check highlight */}
        {isKingInCheck && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: CHECK_COLOR }]} />
        )}
        {/* Selected highlight */}
        {isSelected && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: SELECTED_COLOR }]} />
        )}
        {/* Valid move dot */}
        {isValidMove && !piece && (
          <View style={styles.validMoveDot} />
        )}
        {/* Valid capture ring */}
        {isValidMove && piece && (
          <View style={[StyleSheet.absoluteFill, styles.validCaptureRing]} />
        )}
        {/* Piece */}
        {piece && renderPiece(piece)}
        {/* Coordinate labels on edge squares */}
        {col === 0 && (
          <Text style={[styles.coordLabel, styles.coordRank, { color: isLight ? DARK_SQUARE : LIGHT_SQUARE }]}>
            {8 - row}
          </Text>
        )}
        {row === 7 && (
          <Text style={[styles.coordLabel, styles.coordFile, { color: isLight ? DARK_SQUARE : LIGHT_SQUARE }]}>
            {FILE_LABELS[col]}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const capturedPiecesString = (pieces: Piece[]) => {
    return pieces.map(p =>
      p.color === 'white' ? WHITE_PIECES[p.type] : BLACK_PIECES[p.type]
    ).join(' ');
  };

  const statusText = () => {
    if (gameStatus === 'checkmate') {
      return `Checkmate — ${winner === 'white' ? 'White' : 'Black'} wins! 🏆`;
    }
    if (gameStatus === 'stalemate') return 'Stalemate — Draw!';
    if (gameStatus === 'check') return `Check! ${turn === 'white' ? 'White' : 'Black'} must move.`;
    return turn === 'white' ? "White's turn" : "Black's turn";
  };

  const handleResign = () => {
    Alert.alert(
      'Resign',
      'Are you sure you want to resign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resign',
          style: 'destructive',
          onPress: () => {
            const resigningColor = turn;
            const winningColor: Color = resigningColor === 'white' ? 'black' : 'white';
            setGameStatus('checkmate');
            setWinner(winningColor);
            setTimeout(() => setShowGameOver(true), 200);
          },
        },
      ],
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chess ♟️</Text>
        <View style={styles.turnBadge}>
          <Text style={styles.turnText}>
            {turn === 'white' ? 'White ⬜' : 'Black ⬛'}
          </Text>
        </View>
      </View>

      {/* Captured pieces — Black's captures (white pieces taken) */}
      <View style={styles.capturedBar}>
        <Text style={styles.capturedLabel}>♟ took: </Text>
        <Text style={styles.capturedPieces}>
          {capturedWhite.length > 0 ? capturedPiecesString(capturedWhite) : '—'}
        </Text>
      </View>

      {/* Board */}
      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {board.map((rowArr, row) => (
            <View key={row} style={styles.boardRow}>
              {rowArr.map((_, col) => renderSquare(row, col))}
            </View>
          ))}
        </View>
      </View>

      {/* Captured pieces — White's captures (black pieces taken) */}
      <View style={styles.capturedBar}>
        <Text style={styles.capturedLabel}>⬜ took: </Text>
        <Text style={styles.capturedPieces}>
          {capturedBlack.length > 0 ? capturedPiecesString(capturedBlack) : '—'}
        </Text>
      </View>

      {/* Status bar */}
      <View style={[styles.statusBar, gameStatus === 'check' && styles.statusBarCheck]}>
        <Text style={[styles.statusText, gameStatus === 'check' && styles.statusTextCheck]}>
          {statusText()}
        </Text>
        {(gameStatus === 'playing' || gameStatus === 'check') && (
          <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
            <Text style={styles.resignText}>Resign</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Move history (collapsible) */}
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setShowHistory(v => !v)}
      >
        <Text style={styles.historyToggleText}>
          {showHistory ? '▾ Hide moves' : '▸ Show moves'} ({moveHistory.length})
        </Text>
      </TouchableOpacity>

      {showHistory && (
        <ScrollView style={styles.historyScroll} horizontal>
          <View style={styles.historyContainer}>
            {moveHistory.slice(-20).map((move, i) => {
              const moveNum = moveHistory.length - Math.min(20, moveHistory.length) + i + 1;
              const isWhiteMove = moveNum % 2 === 1;
              return (
                <View key={i} style={styles.historyItem}>
                  {isWhiteMove && (
                    <Text style={styles.historyMoveNumber}>
                      {Math.ceil(moveNum / 2)}.
                    </Text>
                  )}
                  <Text style={[styles.historyMove, isWhiteMove ? styles.whiteMoveText : styles.blackMoveText]}>
                    {move}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Game Over Modal */}
      <Modal
        visible={showGameOver}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGameOver(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {gameStatus === 'stalemate' ? '🤝 Draw!' : `🏆 ${winner === 'white' ? 'White' : 'Black'} Wins!`}
            </Text>
            <Text style={styles.modalSubtitle}>
              {gameStatus === 'stalemate' ? 'Stalemate' : 'Checkmate'}
            </Text>

            <View style={styles.modalDivider} />

            <Text style={styles.modalCapturedTitle}>Captured pieces</Text>
            <View style={styles.modalCapturedRow}>
              <Text style={styles.modalCapturedLabel}>White lost:</Text>
              <Text style={styles.modalCapturedPieces}>
                {capturedWhite.length > 0 ? capturedPiecesString(capturedWhite) : 'None'}
              </Text>
            </View>
            <View style={styles.modalCapturedRow}>
              <Text style={styles.modalCapturedLabel}>Black lost:</Text>
              <Text style={styles.modalCapturedPieces}>
                {capturedBlack.length > 0 ? capturedPiecesString(capturedBlack) : 'None'}
              </Text>
            </View>

            <View style={styles.modalDivider} />

            <TouchableOpacity style={styles.modalPrimaryButton} onPress={resetGame}>
              <Text style={styles.modalPrimaryButtonText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.modalSecondaryButtonText}>Back to Games</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: C.text,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: C.text,
  },
  turnBadge: {
    backgroundColor: C.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: C.border,
  },
  turnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
  },
  capturedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: C.surface,
    minHeight: 28,
  },
  capturedLabel: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '600',
  },
  capturedPieces: {
    fontSize: 14,
    color: C.text,
    letterSpacing: 1,
  },
  boardContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    ...shadows.card,
    borderRadius: 2,
    overflow: 'hidden',
  },
  boardRow: {
    flexDirection: 'row',
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceText: {
    fontSize: FONT_SIZE,
    lineHeight: FONT_SIZE * 1.15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  whitePiece: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  blackPiece: {
    color: '#1A1A1A',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  validMoveDot: {
    width: SQUARE_SIZE * 0.3,
    height: SQUARE_SIZE * 0.3,
    borderRadius: SQUARE_SIZE * 0.15,
    backgroundColor: VALID_MOVE_COLOR,
  },
  validCaptureRing: {
    borderRadius: 0,
    borderWidth: 3,
    borderColor: VALID_MOVE_COLOR,
  },
  coordLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
  },
  coordRank: {
    top: 2,
    left: 2,
  },
  coordFile: {
    bottom: 2,
    right: 3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  statusBarCheck: {
    backgroundColor: '#FFF3CD',
    borderTopColor: '#FDCB6E',
  },
  statusText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: C.text,
    flex: 1,
  },
  statusTextCheck: {
    color: '#856404',
  },
  resignButton: {
    backgroundColor: C.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  resignText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  historyToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  historyToggleText: {
    fontSize: 12,
    color: C.secondary,
    fontWeight: '600',
  },
  historyScroll: {
    maxHeight: 48,
    backgroundColor: C.surface,
  },
  historyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  historyMoveNumber: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '600',
    marginRight: 2,
  },
  historyMove: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  whiteMoveText: {
    backgroundColor: '#FFFFFF',
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  blackMoveText: {
    backgroundColor: '#2D2D2D',
    color: '#FFFFFF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: C.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...shadows.modal,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 16,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: spacing.md,
  },
  modalCapturedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  modalCapturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalCapturedLabel: {
    fontSize: 13,
    color: C.textSecondary,
    width: 80,
  },
  modalCapturedPieces: {
    fontSize: 16,
    color: C.text,
    letterSpacing: 2,
    flex: 1,
  },
  modalPrimaryButton: {
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    backgroundColor: C.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  modalSecondaryButtonText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  });
}
