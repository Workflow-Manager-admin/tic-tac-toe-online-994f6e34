import React, { useState, useEffect } from 'react';
import './App.css';

// --- Constants ---
const BOARD_SIZE = 3;
const EMPTY_BOARD = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
const MODES = {
  PvP: 'Player vs Player',
  PvAI: 'Player vs AI'
};
const PLAYER_SYMBOLS = ['X', 'O'];

// --- Utility Functions ---

// PUBLIC_INTERFACE
function calculateWinner(squares) {
  /**
   * Checks if there is a winner in the current board state or a draw
   * Returns {winner: "X"/"O"/null, winningLine: array|null, draw: boolean}
   */
  const lines = [
    [0, 1, 2],  [3, 4, 5],  [6, 7, 8],
    [0, 3, 6],  [1, 4, 7],  [2, 5, 8],
    [0, 4, 8],  [2, 4, 6]
  ];
  for (let line of lines) {
    const [a, b, c] = line;
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], winningLine: line, draw: false };
    }
  }
  if (squares.every(Boolean)) {
    return { winner: null, winningLine: null, draw: true };
  }
  return { winner: null, winningLine: null, draw: false };
}

function getInitialScore() {
  return {
    X: 0,
    O: 0,
    Draw: 0
  };
}

// PUBLIC_INTERFACE
function getRandomEmptySquare(squares) {
  /** Returns a random empty index for dumb AI (fallback) */
  const empties = squares
    .map((val, idx) => (val === null ? idx : null))
    .filter(idx => idx !== null);
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

// --- Main App Component ---
function App() {
  // Theme
  const [theme, setTheme] = useState('light');

  // Game State
  const [mode, setMode] = useState('PvP'); // 'PvP' or 'PvAI'
  const [squares, setSquares] = useState(EMPTY_BOARD);
  const [xIsNext, setXIsNext] = useState(true);
  const [result, setResult] = useState(null); // { winner, draw, winningLine }
  const [score, setScore] = useState(getInitialScore());
  const [isLoading, setIsLoading] = useState(false); // for AI move

  // AI Chat State
  const [chatMessages, setChatMessages] = useState([
    { from: 'ai', text: "Hi! I'm your Tic Tac Toe companion. Let's play and chat!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatIsSending, setChatIsSending] = useState(false);

  // Apply theme to the document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle game result
  useEffect(() => {
    const r = calculateWinner(squares);
    if (r.winner || r.draw) {
      setResult(r);
      setScore(prev => {
        const s = { ...prev };
        if (r.winner) s[r.winner]++;
        if (r.draw) s.Draw++;
        return s;
      });
    } else {
      setResult(null);
    }
  }, [squares]);

  // Handle AI move if needed
  useEffect(() => {
    // Only trigger if in PvAI mode, O's turn, not finished, not loading
    if (
      mode === 'PvAI' &&
      !xIsNext &&
      !result &&
      !isLoading
    ) {
      // Slight delay for realism
      setIsLoading(true);
      (async () => {
        const move = await getAIMove(squares, 'O');
        if (move !== null && squares[move] === null) {
          // Delay: for UX showing AI is 'thinking'
          setTimeout(() => {
            setSquares(sq => sq.map((sqVal, idx) => idx === move ? 'O' : sqVal));
            setXIsNext(true);
            setIsLoading(false);
          }, 800);
        } else {
          setIsLoading(false);
        }
      })();
    }
    // eslint-disable-next-line
  }, [mode, squares, xIsNext, result]);

  // PUBLIC_INTERFACE
  function handleSquareClick(idx) {
    if (result || squares[idx] || (mode === 'PvAI' && !xIsNext) || isLoading) return;
    setSquares(sq => sq.map((sqVal, i) => (i === idx ? (xIsNext ? 'X' : 'O') : sqVal)));
    setXIsNext(x => !x);
  }

  // PUBLIC_INTERFACE
  function handleRestart() {
    setSquares(EMPTY_BOARD);
    setXIsNext(true);
    setResult(null);
    setIsLoading(false);
  }

  // PUBLIC_INTERFACE
  function handleModeChange(newMode) {
    setMode(newMode);
    setSquares(EMPTY_BOARD);
    setXIsNext(true);
    setResult(null);
    setIsLoading(false);
    setChatMessages([
      { from: 'ai', text: "Hi! I'm your Tic Tac Toe companion. Let's play and chat!" }
    ]);
  }

  // -- Chat Functionality (OpenAI Integration) --
  // PUBLIC_INTERFACE
  async function handleSendChatMessage() {
    if (!chatInput.trim()) return;
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    const userMsg = { from: 'user', text: chatInput };
    setChatMessages(msgs => [...msgs, userMsg]);
    setChatIsSending(true);

    if (!apiKey) {
      // Show a clear message if key is missing
      setChatMessages(msgs => [
        ...msgs,
        {
          from: "ai",
          text:
            "AI chat is disabled because the OpenAI API key is missing. " +
            "Please configure REACT_APP_OPENAI_API_KEY in the server build environment and rebuild the app."
        }
      ]);
      setChatIsSending(false);
      setChatInput('');
      return;
    }

    try {
      // Request to OpenAI's chat endpoint
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a friendly Tic Tac Toe assistant that gives helpful advice, plays fair, and sometimes congratulates the user. The user is chatting from a tic tac toe game UI." },
            ...chatMessages.slice(-5).map(msg =>
              ({
                role: msg.from === 'user' ? 'user' : 'assistant',
                content: msg.text
              })),
            { role: "user", content: chatInput }
          ],
          max_tokens: 64,
          temperature: 0.8
        })
      });
      if (r.ok) {
        const payload = await r.json();
        const aiText = payload.choices?.[0]?.message?.content ?? "I'm here!";
        setChatMessages(msgs => [...msgs, { from: 'ai', text: aiText }]);
      } else {
        let extra = "";
        if (r.status === 401 || r.status === 403)
          extra = " (Authentication failed: bad API key)";
        else if (r.status === 429)
          extra = " (Usage limit reached or too many requests)";
        setChatMessages(msgs => [
          ...msgs,
          { from: 'ai', text: "There was an error contacting AI chat." + extra }
        ]);
      }
    } catch (err) {
      setChatMessages(msgs => [
        ...msgs,
        {
          from: 'ai',
          text:
            "Sorry, failed to contact AI. " +
            "Possible reasons include CORS restrictions, missing API key, or network errors. " +
            "See browser console for more info."
        }
      ]);
    }
    setChatIsSending(false);
    setChatInput('');
  }

  // -- AI Opponent Move (OpenAI Integration) --
  // PUBLIC_INTERFACE
  async function getAIMove(board, aiSymbol) {
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: no API key, return a user-facing warning and random move (safe)
      setChatMessages(msgs => [
        ...msgs,
        {
          from: "ai",
          text:
            "AI move generation is disabled because the OpenAI API key is missing. " +
            "Please configure REACT_APP_OPENAI_API_KEY in the build environment."
        }
      ]);
      return getRandomEmptySquare(board);
    }
    try {
      // Prompt OpenAI to pick a move for Tic Tac Toe as O
      const prompt = `
        You're a Tic Tac Toe AI. Board is a 1D array of 9 values (row-major):
        [${board.map(v => v ? v : " ")}]
        You play as "${aiSymbol}". Pick a square (0-8, empty only). Return just the integer index (e.g. 0, 3, 7). Try to win or block win if possible.`;

      const r = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "text-davinci-003",
          prompt,
          max_tokens: 2,
          temperature: 0.5,
          n: 1
        })
      });
      if (r.ok) {
        const data = await r.json();
        // Extract integer index from OpenAI's best attempt
        const aiResp = data.choices?.[0]?.text?.trim();
        const idx = parseInt(aiResp, 10);
        if (!isNaN(idx) && board[idx] === null && idx >= 0 && idx < 9) {
          return idx;
        }
      }
    } catch (_) { /* fallback below */ }
    // fallback: pick any empty
    return getRandomEmptySquare(board);
  }

  // PURE-UI: Dynamic board rendering
  function renderSquare(idx) {
    const isWinning = result?.winningLine?.includes(idx);
    return (
      <button
        key={idx}
        className={`ttt-square${isWinning ? ' winning' : ''}`}
        onClick={() => handleSquareClick(idx)}
        disabled={!!squares[idx] || !!result || (mode === 'PvAI' && !xIsNext) || isLoading}
        tabIndex={0}
        aria-label={`Square ${idx + 1} ${squares[idx] ? 'filled' : 'empty'}`}
      >
        {squares[idx]}
      </button>
    );
  }

  // PURE-UI: Game control/announcement
  function renderAnnouncement() {
    if (result) {
      if (result.winner) {
        return (
          <span className="ttt-announcement">
            {mode === 'PvAI'
              ? (result.winner === 'X' ? 'You win! 🎉' : 'AI wins! 🤖')
              : `Player ${result.winner} wins! 🎉`
            }
          </span>
        );
      }
      if (result.draw) {
        return <span className="ttt-announcement">It's a draw.</span>;
      }
    } else if (isLoading) {
      return <span className="ttt-announcement">AI is thinking…</span>;
    }
    return (
      <span className="ttt-announcement">
        {mode === 'PvAI'
          ? (xIsNext ? 'Your move.' : 'AI move…')
          : `Player ${xIsNext ? 'X' : 'O'}'s turn`}
      </span>
    );
  }

  // PURE-UI: Scoreboard
  function renderScoreboard() {
    return (
      <div className="ttt-scoreboard">
        <span className="score-label">X: {score.X}</span>
        <span className="score-label">O: {score.O}</span>
        <span className="score-label">Draw: {score.Draw}</span>
      </div>
    );
  }

  // PURE-UI: Mode switcher
  function renderModeControls() {
    return (
      <div className="ttt-mode-switch">
        {Object.entries(MODES).map(([key, label]) => (
          <button
            className={`mode-btn${mode === key ? ' selected' : ''}`}
            key={key}
            onClick={() => handleModeChange(key)}
            disabled={mode === key}
            aria-label={`Switch to ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // PURE-UI: Chat area
  function renderChat() {
    return (
      <div className="ttt-chat-container">
        <div className="ttt-chat-header">AI Chat Assistant</div>
        <div className="ttt-chat-messages">
          {chatMessages.map((msg, i) => (
            <div
              className={`ttt-chat-msg ${msg.from}`}
              key={i}
            >
              <span className="msg-badge">{msg.from === 'ai' ? '🤖' : '🧑'}</span>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="ttt-chat-input-row">
          <input
            className="ttt-chat-input"
            type="text"
            value={chatInput}
            disabled={chatIsSending}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendChatMessage();
            }}
            placeholder="Type here to chat with AI…"
            aria-label="Chat message input"
          />
          <button
            className="ttt-chat-send-btn"
            onClick={handleSendChatMessage}
            disabled={chatIsSending || !chatInput.trim()}
            aria-label="Send chat message"
          >
            {chatIsSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    );
  }

  // --- Main JSX Layout ---
  return (
    <div className="App">
      <header className="App-header">
        <button
          className="theme-toggle"
          onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <h1 className="ttt-title">Tic Tac Toe</h1>
        {renderModeControls()}
        {renderScoreboard()}
        <div className="ttt-announcement-row">{renderAnnouncement()}</div>
        <div className="ttt-board-container">
          <div className="ttt-board" role="grid" aria-label="Tic Tac Toe Board">
            {squares.map((_, idx) => renderSquare(idx))}
          </div>
        </div>
        <div className="ttt-controls-row">
          <button className="ttt-restart-btn" onClick={handleRestart} aria-label="Restart game">
            Restart
          </button>
        </div>
        <div className="ttt-chat-wrapper">{renderChat()}</div>
        <footer className="ttt-footer">
          <span>
            Powered by React & OpenAI • Design by KAVIA
          </span>
        </footer>
      </header>
    </div>
  );
}

export default App;
