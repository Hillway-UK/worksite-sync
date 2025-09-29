import React from 'react';
import autotimeLogo from '@/assets/autotime-logo.jpg';

export const AutoTimeLogo = ({ className = "h-12", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) => {
  return (
    <img 
      src={autotimeLogo} 
      alt="AutoTime Logo" 
      className={`h-full w-auto object-contain ${className} ${variant === "dark" ? "brightness-0 invert" : ""}`}
    />
  );
};