import React from "react";
import { Check, X } from "lucide-react";
import { checkPasswordStrength } from "@/lib/password-policy";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
}) => {
  if (!password) return null;

  const { strength, checks } = checkPasswordStrength(password);

  const strengthColors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500",
    strong: "bg-green-500",
  };

  const strengthText = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${strengthColors[strength]}`}
            style={{ width: `${(Object.values(checks).filter(Boolean).length / 5) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium">{strengthText[strength]}</span>
      </div>

      <ul className="space-y-1 text-sm">
        <RequirementItem met={checks.length}>At least 8 characters</RequirementItem>
        <RequirementItem met={checks.uppercase}>One uppercase letter (A-Z)</RequirementItem>
        <RequirementItem met={checks.lowercase}>One lowercase letter (a-z)</RequirementItem>
        <RequirementItem met={checks.number}>One number (0-9)</RequirementItem>
        <RequirementItem met={checks.special}>
          One special character (!@#$%^&*)
        </RequirementItem>
      </ul>
    </div>
  );
};

const RequirementItem: React.FC<{ met: boolean; children: React.ReactNode }> = ({
  met,
  children,
}) => (
  <li className="flex items-center gap-2">
    {met ? (
      <Check className="h-4 w-4 text-green-600" />
    ) : (
      <X className="h-4 w-4 text-muted-foreground" />
    )}
    <span className={met ? "text-green-600" : "text-muted-foreground"}>{children}</span>
  </li>
);
