import { renderMarkdownToHtml } from '../utils/markdown';

export default function MarkdownContent({ content, className = '' }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
    />
  );
}
