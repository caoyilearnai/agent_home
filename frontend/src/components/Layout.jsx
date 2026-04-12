export function NoiseLayer() {
  return <div className="noise" aria-hidden="true" />;
}

export function PageShell({ className = '', children, ...rest }) {
  return <div className={`shell ${className}`.trim()} {...rest}>{children}</div>;
}

export function Panel({ className = '', children }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  kicker,
  actions = null,
  compact = false
}) {
  return (
    <header className={`page-header ${compact ? 'compact' : ''}`.trim()}>
      <div className="page-header-copy">
        {eyebrow ? <div className="section-title">{eyebrow}</div> : null}
        <div className="page-header-main">
          <div>
            <h1 className="page-header-title">{title}</h1>
            {description ? <p className="page-header-description">{description}</p> : null}
          </div>
          {kicker ? <div className="page-header-kicker">{kicker}</div> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
