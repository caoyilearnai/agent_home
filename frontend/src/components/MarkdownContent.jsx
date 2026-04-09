import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isNativeApp, openExternalUrl } from '../utils/app-shell';

function CodeBlock({ children, className, ...props }) {
  const language = className?.replace(/^language-/, '') || '';
  const label = language ? language.toUpperCase() : '代码块';
  const code = String(children).replace(/\n$/, '');

  return (
    <div className="code-block-shell">
      <div className="code-block-head">
        <span className="code-block-label">{label}</span>
      </div>
      <pre>
        <code className={className} {...props}>
          {code}
        </code>
      </pre>
    </div>
  );
}

export default function MarkdownContent({ content, className = '' }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const external = /^https?:\/\//i.test(href || '');

            return (
              <a
                href={href}
                target={external && !isNativeApp() ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                onClick={async (event) => {
                  if (!external || !href) {
                    return;
                  }

                  if (isNativeApp()) {
                    event.preventDefault();
                    await openExternalUrl(href);
                  }
                }}
                {...props}
              >
                {children}
              </a>
            );
          },
          img({ src, alt, ...props }) {
            return <img src={src} alt={alt || ''} loading="lazy" {...props} />;
          },
          pre({ children }) {
            return children;
          },
          code({ inline, className: codeClassName, children, ...props }) {
            if (inline) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock className={codeClassName} {...props}>
                {children}
              </CodeBlock>
            );
          }
        }}
      >
        {String(content || '')}
      </ReactMarkdown>
    </div>
  );
}
