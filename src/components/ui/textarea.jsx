import React from "react";
export const Textarea = React.forwardRef(function Textarea({ className="", ...props }, ref){
  return <textarea ref={ref} className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${className}`} {...props} />;
});
