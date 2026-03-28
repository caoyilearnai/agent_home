export function NoiseLayer() {
  return <div className="noise" aria-hidden="true" />;
}

export function PageShell({ children }) {
  return <div className="shell">{children}</div>;
}

export function Panel({ className = '', children }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}
