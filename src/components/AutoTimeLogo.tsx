import React from "react";
import logoImage from "@/assets/autotime-logo.jpg";

export const TimeTrackLogo = ({
  className = "h-12",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) => {
  const textColor = variant === "light" ? "text-white" : "text-primary";
  const subtitleColor = variant === "light" ? "text-white/80" : "text-muted-foreground";

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img src={logoImage} alt="TimeTrack Logo" className="h-12 w-12 object-contain" />
      <div className="flex flex-col">
        <div className={`font-bold text-2xl ${textColor}`}>TimeTrack</div>
        <div className={`text-xs tracking-wide uppercase ${subtitleColor}`}>Workforce Time Management</div>
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const AutoTimeLogo = TimeTrackLogo;
