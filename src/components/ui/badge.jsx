import React from "react";
export function Badge({ className="", ...props }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border bg-slate-50 text-slate-700 border-slate-200 ${className}`} {...props} />;
}
