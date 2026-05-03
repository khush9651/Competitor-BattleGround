import ReactMarkdown from 'react-markdown';

export default function SectionCard({ label, icon, badgeClass, content }) {
  const isEmpty =
    !content?.trim() || content.includes('Not enough information found');

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/80 p-5 shadow-lg transition-colors duration-300 hover:border-slate-300/90 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/15">
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${badgeClass}`}
        >
          {icon}
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors duration-300 dark:text-slate-500">
          {label}
        </span>
      </div>
      <div className="prose prose-sm prose-slate max-w-none text-sm transition-colors duration-300 dark:prose-invert dark:text-slate-300">
        {isEmpty ? (
          <p className="italic text-slate-500 dark:text-slate-500">Not enough information found</p>
        ) : (
          <ReactMarkdown>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
