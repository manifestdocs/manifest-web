/**
 * Terminal service for connecting xterm.js to Claude Code via WebSocket.
 *
 * Protocol:
 * - Binary frames: Raw PTY stdin/stdout
 * - Text frames: JSON control messages (resize, shutdown, status)
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { API_BASE_URL } from '$lib/api/client';

/** Control messages sent/received as JSON text frames */
type ControlMessage =
	| { type: 'resize'; cols: number; rows: number }
	| { type: 'shutdown' }
	| { type: 'status'; connected: boolean; message: string };

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Terminal service configuration */
export interface TerminalConfig {
	projectId: string;
	sessionId?: string;
	onConnectionStateChange?: (state: ConnectionState, message?: string) => void;
}

/** Debounce helper */
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	return ((...args: unknown[]) => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	}) as T;
}

/**
 * Terminal service wrapping xterm.js with WebSocket connection to backend PTY.
 */
export class TerminalService {
	private terminal: Terminal;
	private fitAddon: FitAddon;
	private webLinksAddon: WebLinksAddon;
	private socket: WebSocket | null = null;
	private config: TerminalConfig;
	private connectionState: ConnectionState = 'disconnected';
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 3;
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | undefined;
	private disposed = false;
	private resizeObserver: ResizeObserver | null = null;

	// Write batching to prevent ANSI sequence splitting issues
	private writeBuffer: string[] = [];
	private writeScheduled = false;

	constructor(config: TerminalConfig) {
		this.config = config;

		// Create terminal with sensible defaults
		// Fira Code is loaded as a web font for guaranteed box-drawing/Unicode coverage
		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: "'Fira Code', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
			// TUI app optimizations - prevent double line rendering
			lineHeight: 1,
			letterSpacing: 0,
			convertEol: false,
			allowTransparency: false,
			scrollback: 10000,
			theme: {
				background: '#0d1117',
				foreground: '#c9d1d9',
				cursor: '#58a6ff',
				selectionBackground: '#264f78',
				black: '#0d1117',
				red: '#ff7b72',
				green: '#7ee787',
				yellow: '#d29922',
				blue: '#58a6ff',
				magenta: '#bc8cff',
				cyan: '#76e3ea',
				white: '#c9d1d9',
				brightBlack: '#484f58',
				brightRed: '#ffa198',
				brightGreen: '#56d364',
				brightYellow: '#e3b341',
				brightBlue: '#79c0ff',
				brightMagenta: '#d2a8ff',
				brightCyan: '#b3f0ff',
				brightWhite: '#f0f6fc'
			}
		});

		this.fitAddon = new FitAddon();
		this.webLinksAddon = new WebLinksAddon();

		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.webLinksAddon);

		// Handle terminal input
		this.terminal.onData((data) => {
			this.sendBinary(new TextEncoder().encode(data));
		});

		// Handle binary input (for special keys)
		this.terminal.onBinary((data) => {
			const bytes = new Uint8Array(data.length);
			for (let i = 0; i < data.length; i++) {
				bytes[i] = data.charCodeAt(i);
			}
			this.sendBinary(bytes);
		});
	}

	/**
	 * Mount the terminal to a container element.
	 */
	mount(container: HTMLElement): void {
		this.terminal.open(container);

		// Try WebGL renderer for better performance, fall back to canvas
		try {
			const webglAddon = new WebglAddon();
			webglAddon.onContextLoss(() => {
				webglAddon.dispose();
			});
			this.terminal.loadAddon(webglAddon);
		} catch {
			console.warn('WebGL renderer not available, using canvas');
		}

		this.fit();

		// Set up resize observer with debounced fit
		const debouncedFit = debounce(() => this.fit(), 100);
		this.resizeObserver = new ResizeObserver(debouncedFit);
		this.resizeObserver.observe(container);
	}

	/**
	 * Connect to the backend WebSocket.
	 */
	connect(): void {
		if (this.disposed) return;
		if (this.socket?.readyState === WebSocket.OPEN) return;

		this.setConnectionState('connecting');

		const wsUrl = this.buildWebSocketUrl();
		this.socket = new WebSocket(wsUrl);
		this.socket.binaryType = 'arraybuffer';

		this.socket.onopen = () => {
			this.setConnectionState('connected');
			this.reconnectAttempts = 0;
			this.terminal.focus();

			// Send initial resize
			this.sendResize();
		};

		this.socket.onmessage = (event) => {
			if (event.data instanceof ArrayBuffer) {
				// Binary frame: PTY output - use batched write to prevent ANSI splitting
				const text = new TextDecoder().decode(event.data);
				this.batchedWrite(text);
			} else if (typeof event.data === 'string') {
				// Text frame: control message
				try {
					const msg = JSON.parse(event.data) as ControlMessage;
					this.handleControlMessage(msg);
				} catch {
					// Ignore invalid JSON
				}
			}
		};

		this.socket.onclose = (event) => {
			if (this.disposed) return;

			const wasConnected = this.connectionState === 'connected';
			this.socket = null;

			if (wasConnected && !event.wasClean) {
				this.attemptReconnect();
			} else {
				this.setConnectionState('disconnected', event.reason || 'Connection closed');
			}
		};

		this.socket.onerror = () => {
			// Error details are not exposed to JavaScript for security reasons
			// The close event will fire after this
		};
	}

	/**
	 * Disconnect from the backend.
	 */
	disconnect(): void {
		this.cancelReconnect();
		if (this.socket) {
			// Send shutdown message before closing
			this.sendControl({ type: 'shutdown' });
			this.socket.close(1000, 'Client disconnect');
			this.socket = null;
		}
		this.setConnectionState('disconnected');
	}

	/**
	 * Clear the terminal screen.
	 */
	clear(): void {
		this.terminal.clear();
	}

	/**
	 * Focus the terminal.
	 */
	focus(): void {
		this.terminal.focus();
	}

	/**
	 * Fit the terminal to its container and notify backend of new size.
	 */
	fit(): void {
		try {
			this.fitAddon.fit();
			this.sendResize();
		} catch {
			// Ignore fit errors (can happen during unmount)
		}
	}

	/**
	 * Get current connection state.
	 */
	getConnectionState(): ConnectionState {
		return this.connectionState;
	}

	/**
	 * Dispose the terminal and clean up resources.
	 */
	dispose(): void {
		this.disposed = true;
		this.cancelReconnect();
		this.disconnect();
		this.resizeObserver?.disconnect();
		this.terminal.dispose();
	}

	private buildWebSocketUrl(): string {
		// Convert HTTP URL to WebSocket URL
		const httpUrl = new URL(API_BASE_URL);
		const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = new URL(`${wsProtocol}//${httpUrl.host}${httpUrl.pathname}`);

		// Add terminal endpoint
		wsUrl.pathname = `${wsUrl.pathname}/terminal/ws/${this.config.projectId}`;

		// Add session ID if provided
		if (this.config.sessionId) {
			wsUrl.searchParams.set('session_id', this.config.sessionId);
		}

		return wsUrl.toString();
	}

	private sendBinary(data: Uint8Array): void {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(data);
		}
	}

	private sendControl(msg: ControlMessage): void {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(msg));
		}
	}

	private sendResize(): void {
		const { cols, rows } = this.terminal;
		if (cols > 0 && rows > 0) {
			this.sendControl({ type: 'resize', cols, rows });
		}
	}

	private handleControlMessage(msg: ControlMessage): void {
		switch (msg.type) {
			case 'status':
				if (!msg.connected) {
					this.setConnectionState('disconnected', msg.message);
				}
				break;
		}
	}

	private setConnectionState(state: ConnectionState, message?: string): void {
		this.connectionState = state;
		this.config.onConnectionStateChange?.(state, message);
	}

	private attemptReconnect(): void {
		if (this.disposed) return;
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.setConnectionState('disconnected', 'Max reconnection attempts reached');
			return;
		}

		this.setConnectionState('reconnecting');
		this.reconnectAttempts++;

		// Exponential backoff: 1s, 2s, 4s
		const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;

		this.reconnectTimeoutId = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private cancelReconnect(): void {
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = undefined;
		}
	}

	/**
	 * Batch writes using requestAnimationFrame to prevent ANSI sequence splitting.
	 * Multiple rapid WebSocket messages get combined into a single terminal.write() call.
	 */
	private batchedWrite(text: string): void {
		this.writeBuffer.push(text);

		if (!this.writeScheduled) {
			this.writeScheduled = true;
			requestAnimationFrame(() => {
				if (this.writeBuffer.length > 0) {
					const combined = this.writeBuffer.join('');
					this.writeBuffer = [];
					this.terminal.write(combined);
				}
				this.writeScheduled = false;
			});
		}
	}
}
