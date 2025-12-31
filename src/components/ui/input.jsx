import React from "react";
export const Input = React.forwardRef(function Input({ className="", ...props }, ref){
  return <input ref={ref} className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${className}`} {...props} />;
});
