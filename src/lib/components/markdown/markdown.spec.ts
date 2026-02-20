import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  describe('with empty or falsy input', () => {
    it('returns an empty string for empty input', () => {
      expect(renderMarkdown('')).toBe('');
    });
  });

  describe('with plain text', () => {
    it('wraps text in a paragraph tag', () => {
      const result = renderMarkdown('Hello world');
      expect(result).toContain('<p>');
      expect(result).toContain('Hello world');
    });
  });

  describe('with basic markdown', () => {
    it('renders headings', () => {
      const result = renderMarkdown('# My Heading');
      expect(result).toContain('<h1>');
      expect(result).toContain('My Heading');
    });

    it('renders bold text', () => {
      const result = renderMarkdown('**bold**');
      expect(result).toContain('<strong>');
    });

    it('renders inline code', () => {
      const result = renderMarkdown('`code`');
      expect(result).toContain('<code>');
    });

    it('renders links', () => {
      const result = renderMarkdown('[example](https://example.com)');
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
    });
  });

  describe('XSS sanitization', () => {
    it('strips script tags', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(');
    });

    it('strips inline event handlers from HTML', () => {
      const result = renderMarkdown('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('strips javascript: protocol from anchor hrefs', () => {
      const result = renderMarkdown('[click me](javascript:alert(1))');
      expect(result).not.toContain('javascript:');
    });

    it('strips data: URI in links', () => {
      const result = renderMarkdown('<a href="data:text/html,<script>alert(1)</script>">click</a>');
      expect(result).not.toContain('data:text/html');
    });

    it('strips on* attributes from arbitrary elements', () => {
      const result = renderMarkdown('<div onmouseover="alert(1)">hover me</div>');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('with fenced code blocks', () => {
    it('renders a code block with hljs class for a known language', () => {
      const result = renderMarkdown('```rust\nfn main() {}\n```');
      expect(result).toContain('class="hljs language-rust"');
    });

    it('renders a code block without highlight for unknown language', () => {
      const result = renderMarkdown('```unknownlang\nsome code\n```');
      expect(result).toContain('<code');
      expect(result).toContain('some code');
    });

    it('renders a code block for typescript', () => {
      const result = renderMarkdown('```typescript\nconst x: number = 1;\n```');
      expect(result).toContain('class="hljs language-typescript"');
    });

    it('renders a code block using the ts alias', () => {
      const result = renderMarkdown('```ts\nconst x = 1;\n```');
      expect(result).toContain('hljs');
    });
  });

  describe('with GFM features', () => {
    it('renders task lists (GFM checkbox)', () => {
      const result = renderMarkdown('- [ ] todo\n- [x] done');
      expect(result).toContain('<li>');
    });

    it('renders line breaks within paragraphs (breaks: true)', () => {
      // With breaks:true, a single newline in a paragraph becomes <br>
      const result = renderMarkdown('line one\nline two');
      expect(result).toContain('<br');
    });
  });
});
