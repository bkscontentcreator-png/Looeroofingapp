import React from "react";
export function Button({ variant="default", size="default", className="", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border";
  const variants = {
    default: "bg-black text-white border-black hover:opacity-90",
    outline: "bg-white text-black border-slate-200 hover:bg-slate-50",
    destructive: "bg-red-600 text-white border-red-600 hover:opacity-90",
    secondary: "bg-slate-100 text-black border-slate-200 hover:bg-slate-200",
  };
  const sizes = { default: "", icon: "w-10 h-10 p-0" };
  return <button className={`${base} ${variants[variant]||variants.default} ${sizes[size]||""} ${className}`} {...props} />;
}
