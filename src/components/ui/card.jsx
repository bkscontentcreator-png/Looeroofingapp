import React from "react";
export function Card({ className="", style, ...props }) { return <div className={`border rounded-2xl bg-white ${className}`} style={style} {...props} />; }
export function CardHeader({ className="", ...props }) { return <div className={`p-4 ${className}`} {...props} />; }
export function CardTitle({ className="", ...props }) { return <div className={`font-semibold ${className}`} {...props} />; }
export function CardContent({ className="", ...props }) { return <div className={`p-4 pt-0 ${className}`} {...props} />; }
