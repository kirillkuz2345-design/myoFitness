import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className = "", ...props }: InputProps) => {
  return (
    <div className="w-full">
      {label && (
        <label className="text-[7px] font-bold uppercase text-[#989AA0] block mb-1">
          {label}
        </label>
      )}
      <input 
        className={`bg-[#0A0A0A] border border-[#262626] rounded-lg p-3 text-[11px] w-full outline-none focus:border-[#00E676]/50 transition-colors font-mono text-white ${className}`} 
        {...props} 
      />
    </div>
  );
};