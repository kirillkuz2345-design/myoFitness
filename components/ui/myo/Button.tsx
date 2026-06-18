import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export const Button = ({ variant = "primary", className = "", ...props }: ButtonProps) => {
  const base = "cursor-pointer rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-[#00E676] text-black hover:bg-white px-6 py-2 shadow-[0_4px_25px_rgba(16,185,129,0.15)]",
    secondary: "border border-[#262626] text-[#989AA0] hover:text-white hover:border-[#333] px-6 py-2",
    danger: "text-[#333] hover:text-rose-500 p-2"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
};