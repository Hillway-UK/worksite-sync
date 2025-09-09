import React from 'react';

export const AutoTimeLogo = ({ className = "h-12", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) => {
  const textColor = variant === "light" ? "text-white" : "text-black";
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center">
        <div className="w-8 h-8 bg-current rounded-sm flex items-center justify-center">
          <div className="text-white text-lg font-bold" style={{ color: variant === "light" ? "#000" : "#fff" }}>
            A
          </div>
        </div>
      </div>
      <div>
        <div className={`font-bold text-2xl ${textColor}`}>AutoTime</div>
      </div>
    </div>
  );
};