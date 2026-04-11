export function NoiseLayer() {
  return <div className="noise" aria-hidden="true" />;
}

export function PageShell({ className = '', children, ...rest }) {
  return <div className={`shell ${className}`.trim()} {...rest}>{children}</div>;
}

export function Panel({ className = '', children }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}
