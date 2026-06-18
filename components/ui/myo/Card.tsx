import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className = "" }: CardProps) => {
  return (
    <div className={`bg-[#141519] border border-[#262626] p-5 rounded-xl ${className}`}>
      {children}
    </div>
  );
};