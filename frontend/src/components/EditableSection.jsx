import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function EditableSection({
  label,
  icon,
  badgeClass,
  value,
  onPatch,
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const isEmpty = !value?.trim() || value.includes('Not enough information found');

  return (
    <div className="group rounded-xl border border-slate-200/90 bg-white/80 p-5 shadow-lg transition-colors duration-300 hover:border-indigo-300/50 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-indigo-500/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${badgeClass}`}
          >
            {icon}
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors duration-300 dark:text-slate-500">
              {label}
            </div>
            {!editing && (
              <p className="text-[11px] text-slate-500 transition-colors duration-300 dark:text-slate-600">
                Click text to edit
              </p>
            )}
          </div>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 opacity-0 transition duration-300 hover:bg-indigo-100 group-hover:opacity-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 transition-colors duration-300 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/40 dark:hover:bg-emerald-500/30"
          >
            Save
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onPatch(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-indigo-500/30 transition duration-300 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-200 dark:placeholder-slate-600 dark:focus:border-indigo-400"
          spellCheck={false}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-lg bg-slate-50 p-4 text-left text-sm transition-colors duration-300 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/70"
        >
          {isEmpty ? (
            <p className="italic text-slate-500 transition-colors duration-300 dark:text-slate-500">
              Not enough information found
            </p>
          ) : (
            <div className="prose prose-sm prose-slate max-w-none transition-colors duration-300 dark:prose-invert dark:text-slate-300 [&_li]:marker:text-indigo-600 dark:[&_li]:marker:text-indigo-400">
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          )}
        </button>
      )}
    </div>
  );
}
