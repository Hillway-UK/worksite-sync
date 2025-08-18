import React from 'react';

export const PioneerLogo = ({ className = "h-12", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) => {
  const color = variant === "light" ? "#FFFFFF" : "#702D30";
  const textColor = variant === "light" ? "text-white" : "text-[#702D30]";
  const subColor = variant === "light" ? "text-white/90" : "text-[#111111]";
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-8" style={{ backgroundColor: color }}></div>
        <div className="w-2 h-10" style={{ backgroundColor: color }}></div>
        <div className="w-2 h-12" style={{ backgroundColor: color }}></div>
        <div className="flex flex-col space-y-1">
          <div className="w-8 h-2" style={{ backgroundColor: color }}></div>
          <div className="w-6 h-2" style={{ backgroundColor: color }}></div>
        </div>
      </div>
      <div>
        <div className={`font-heading font-extrabold text-2xl ${textColor}`}>PIONEER</div>
        <div className={`font-body text-xs tracking-widest -mt-1 ${subColor}`}>AUTO TIMESHEETS</div>
      </div>
    </div>
  );
};