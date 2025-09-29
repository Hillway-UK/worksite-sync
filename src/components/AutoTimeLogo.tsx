import React from 'react';
import autotimeLogo from '@/assets/autotime-logo.jpg';

export const AutoTimeLogo = ({ className = "h-12", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={autotimeLogo} 
        alt="AutoTime Logo" 
        className="h-full w-auto object-contain"
        style={{
          filter: variant === "light" ? "brightness(0) invert(1)" : "none"
        }}
      />
    </div>
  );
};