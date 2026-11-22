const icons = import.meta.glob('./icons/*.svg', { query: '?raw', import: 'default', eager: true });
export function ReportIcon({ name }: { name: string }) {
  return <span className="report-svg" aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: icons[`./icons/${name}.svg`] as string }} />;
}
