<script lang="ts">
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { WebglAddon } from '@xterm/addon-webgl';
  import { WebLinksAddon } from '@xterm/addon-web-links';
  import { getWsBaseUrl } from '$lib/api/client.js';
  import '@xterm/xterm/css/xterm.css';

  interface Props {
    class?: string;
    cwd?: string;
    initialInput?: string;
    isActive?: boolean;
    onBell?: () => void;
    onIdle?: () => void;
    onReady?: (send: (text: string) => void) => void;
  }

  const IDLE_TIMEOUT_MS = 3000;

  let { class: className = '', cwd, initialInput, isActive = false, onBell, onIdle, onReady }: Props = $props();

  let termRef: Terminal | null = null;

  $effect(() => {
    if (isActive && termRef) {
      termRef.focus();
    }
  });

  function terminalInit(node: HTMLElement) {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, "SF Mono", Monaco, "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.0,
      letterSpacing: 0,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        selectionForeground: '#ffffff',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#76e3ea',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#b3f0ff',
        brightWhite: '#ffffff',
      },
      allowTransparency: false,
      customGlyphs: true,
      drawBoldTextInBrightColors: true,
      scrollback: 10000,
      convertEol: false,
      windowOptions: {},
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(node);

    // Web links addon — Cmd+click (Mac) or Ctrl+click opens URLs
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // WebGL addon for smooth rendering — fallback to canvas
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {
      console.warn('WebGL addon failed, using canvas renderer');
    }

    fitAddon.fit();
    termRef = term;
    term.focus();

    // Cmd+C copies selected text instead of sending SIGINT.
    // Cmd+V pastes from clipboard into the terminal.
    // All other keys pass through to the PTY.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      const isMeta = event.metaKey || event.ctrlKey;

      if (isMeta && event.key === 'c' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection());
        return false;
      }

      if (isMeta && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text && ws?.readyState === WebSocket.OPEN) {
            ws.send(text);
          }
        });
        return false;
      }

      return true;
    });

    // Connect to server PTY via WebSocket
    const wsUrl = `${getWsBaseUrl()}/api/v1/terminal/ws${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''}`;
    let ws: WebSocket | null = new WebSocket(wsUrl);

    ws.binaryType = 'arraybuffer';

    let initialInputSent = false;

    ws.onopen = () => {
      // Send initial resize after connection
      if (term.cols > 0 && term.rows > 0) {
        ws?.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
      }
      // Expose send function to parent for external input (context chips, etc.)
      onReady?.((text: string) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(text);
        }
      });
    };

    // Idle detection: fires onIdle when no output received for IDLE_TIMEOUT_MS
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        onIdle?.();
      }, IDLE_TIMEOUT_MS);
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else if (typeof event.data === 'string') {
        term.write(event.data);
      }

      resetIdleTimer();

      // After first output (shell prompt), inject initial input once
      if (initialInput && !initialInputSent) {
        initialInputSent = true;
        setTimeout(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(initialInput);
          }
        }, 150);
      }
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[90m[Terminal disconnected]\x1b[0m\r\n');
    };

    // Egress: User input -> WebSocket -> PTY
    const dataDisposable = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize sync: debounced via rAF to avoid TUI glitching.
    // Skip fit when pane is collapsed (0 dimensions) to avoid corrupting
    // terminal state. ResizeObserver fires again on re-expand with real
    // dimensions, so the session restores cleanly.
    let resizeRaf: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        if (node.clientWidth === 0 || node.clientHeight === 0) return;
        try {
          fitAddon.fit();
        } catch {
          // Ignore fit errors during rapid resize
        }
        if (term.cols > 0 && term.rows > 0 && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
        }
      });
    });
    resizeObserver.observe(node);

    // Terminal bell — notify parent when process requests attention
    const bellDisposable = term.onBell(() => {
      onBell?.();
    });

    return {
      destroy() {
        if (idleTimer) clearTimeout(idleTimer);
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        dataDisposable.dispose();
        bellDisposable.dispose();
        resizeObserver.disconnect();
        if (ws) {
          ws.close();
          ws = null;
        }
        termRef = null;
        term.dispose();
      },
    };
  }
</script>

<div class="terminal-container {className}" use:terminalInit></div>

<style>
  .terminal-container {
    height: 100%;
    width: 100%;
    padding: 16px 0 0 12px;
  }

  /* Ensure xterm fills its container and canvas layers don't overflow */
  .terminal-container :global(.xterm) {
    height: 100%;
  }

  .terminal-container :global(.xterm-viewport) {
    overflow-y: auto !important;
  }

  .terminal-container :global(.xterm-viewport)::-webkit-scrollbar {
    width: 6px;
  }

  .terminal-container :global(.xterm-viewport)::-webkit-scrollbar-track {
    background: transparent;
  }

  .terminal-container :global(.xterm-viewport)::-webkit-scrollbar-thumb {
    background: rgba(156, 220, 254, 0.2);
  }

  .terminal-container :global(.xterm-viewport)::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 220, 254, 0.3);
  }

  .terminal-container :global(.xterm-screen) {
    height: 100%;
  }
</style>
