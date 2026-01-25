/**
 * Chat API client for AI assistance.
 *
 * Supports streaming responses from both local CLI agents (via ACP)
 * and remote cloud APIs (Gemini, OpenAI-compatible).
 */

import { API_BASE_URL } from './client.js';

// ============================================================================
// Message Types (aligned with ACP ContentBlock patterns)
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ContentBlock {
	type: 'text' | 'tool_use' | 'tool_result';
	text?: string;
	toolId?: string;
	toolName?: string;
	toolStatus?: 'pending' | 'running' | 'completed' | 'failed';
	toolInput?: Record<string, unknown>;
	toolResult?: string;
}

export interface ChatMessage {
	id: string;
	role: MessageRole;
	content: ContentBlock[];
	createdAt: string;
	isStreaming?: boolean;
}

// ============================================================================
// Streaming Event Types (ACP-compatible)
// ============================================================================

export type StreamEventType =
	| 'message_start'
	| 'content_block_start'
	| 'content_block_delta'
	| 'content_block_stop'
	| 'message_stop'
	| 'tool_call'
	| 'tool_call_update'
	| 'error';

export interface StreamEvent {
	type: StreamEventType;
	// For content_block_delta
	delta?: {
		type: 'text_delta';
		text: string;
	};
	// For tool_call
	tool?: {
		id: string;
		name: string;
		input?: Record<string, unknown>;
	};
	// For tool_call_update
	status?: 'pending' | 'in_progress' | 'completed' | 'failed';
	// For error
	error?: {
		message: string;
		code?: string;
	};
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ChatRequest {
	messages: Array<{
		role: MessageRole;
		content: string;
	}>;
	context?: {
		featureId?: string;
		featureTitle?: string;
		featureDetails?: string;
		projectId?: string;
		/** Whether this is a leaf feature (true) or a feature set with children (false) */
		isLeaf?: boolean;
	};
	model?: string; // 'local' | 'gemini-2.5-flash' | etc.
	stream?: boolean;
}

export interface ChatStreamCallbacks {
	onStart?: () => void;
	onTextDelta?: (text: string) => void;
	onToolCall?: (tool: { id: string; name: string; input?: Record<string, unknown> }) => void;
	onToolUpdate?: (toolId: string, status: string, result?: string) => void;
	onComplete?: () => void;
	onError?: (error: Error) => void;
}

// ============================================================================
// Chat Client
// ============================================================================

export class ChatClient {
	private baseUrl: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Send a chat message and stream the response.
	 */
	async sendMessage(
		request: ChatRequest,
		callbacks: ChatStreamCallbacks
	): Promise<void> {
		callbacks.onStart?.();

		try {
			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'text/event-stream'
				},
				body: JSON.stringify(request)
			});

			if (!response.ok) {
				throw new Error(`Chat request failed: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('No response body');
			}

			await this.processStream(reader, callbacks);
			callbacks.onComplete?.();

		} catch (error) {
			callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
		}
	}

	private async processStream(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		callbacks: ChatStreamCallbacks
	): Promise<void> {
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Process complete SSE events
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const jsonStr = line.slice(6).trim();
					if (jsonStr === '[DONE]') {
						return;
					}

					try {
						const event = JSON.parse(jsonStr) as StreamEvent;
						this.handleStreamEvent(event, callbacks);
					} catch {
						// Try legacy format: { text: string, done: boolean }
						try {
							const legacy = JSON.parse(jsonStr) as { text?: string; done?: boolean };
							if (legacy.text) {
								callbacks.onTextDelta?.(legacy.text);
							}
							if (legacy.done) {
								return;
							}
						} catch {
							// Ignore malformed JSON
						}
					}
				}
			}
		}
	}

	private handleStreamEvent(event: StreamEvent, callbacks: ChatStreamCallbacks): void {
		switch (event.type) {
			case 'content_block_delta':
				if (event.delta?.type === 'text_delta' && event.delta.text) {
					callbacks.onTextDelta?.(event.delta.text);
				}
				break;

			case 'tool_call':
				if (event.tool) {
					callbacks.onToolCall?.(event.tool);
				}
				break;

			case 'tool_call_update':
				if (event.tool?.id && event.status) {
					callbacks.onToolUpdate?.(event.tool.id, event.status);
				}
				break;

			case 'error':
				if (event.error) {
					callbacks.onError?.(new Error(event.error.message));
				}
				break;

			case 'message_stop':
				// Stream complete
				break;
		}
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateMessageId(): string {
	return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createTextContent(text: string): ContentBlock[] {
	return [{ type: 'text', text }];
}

export function getTextFromContent(content: ContentBlock[]): string {
	return content
		.filter((block) => block.type === 'text' && block.text)
		.map((block) => block.text)
		.join('');
}

// Default client instance
export const chatClient = new ChatClient();
