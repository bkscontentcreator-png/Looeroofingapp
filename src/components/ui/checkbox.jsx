import React from "react";
export function Checkbox({ checked, onCheckedChange, className="" }) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 ${className}`}
      checked={!!checked}
      onChange={(e)=>onCheckedChange?.(e.target.checked)}
    />
  );
}
