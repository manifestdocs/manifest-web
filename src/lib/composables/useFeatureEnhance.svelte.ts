import { API_BASE_URL } from '$lib/api/client.js';

export function useFeatureEnhance() {
    let isEnhancing = $state(false);

    async function enhance(
        featureId: string,
        currentDetails: string,
        onUpdate: (chunk: string) => void
    ) {
        if (isEnhancing) return;

        isEnhancing = true;

        const prompt = `Based on the current content, enhance this feature documentation to be more detailed and well-structured. Maintain the existing style and add:
- Clearer user stories if applicable
- Technical considerations
- Edge cases or acceptance criteria
Keep the response concise and actionable. Return ONLY the enhanced documentation, no explanations.`;

        try {
            const response = await fetch(`${API_BASE_URL}/assist/enhance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream'
                },
                body: JSON.stringify({
                    prompt,
                    feature_id: featureId
                })
            });

            if (!response.ok) {
                console.error('Enhance request failed:', response.status);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let sseBuffer = '';
            let pendingText = '';
            let lastUpdate = 0;
            const UPDATE_INTERVAL = 50; // Batch updates every 50ms

            // Add separator if there's existing content
            if (currentDetails.trim()) {
                onUpdate('\n\n---\n\n**AI Enhanced:**\n\n');
            }

            // Flush pending text to update callback
            const flushPending = () => {
                if (pendingText) {
                    onUpdate(pendingText);
                    pendingText = '';
                    lastUpdate = Date.now();
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    flushPending();
                    break;
                }

                sseBuffer += decoder.decode(value, { stream: true });

                // Process complete SSE events
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        try {
                            const chunk = JSON.parse(jsonStr) as { text: string; done: boolean };
                            if (chunk.text) {
                                pendingText += chunk.text;
                                // Batch updates - only update DOM periodically
                                if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
                                    flushPending();
                                }
                            }
                            if (chunk.done) {
                                flushPending();
                                isEnhancing = false;
                                return;
                            }
                        } catch {
                            // Ignore malformed JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Enhance failed:', error);
        } finally {
            isEnhancing = false;
        }
    }

    return {
        get isEnhancing() { return isEnhancing; },
        enhance
    };
}
