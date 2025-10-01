import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";

interface TempPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function TempPasswordModal({ open, onOpenChange, manager }: TempPasswordModalProps) {
  const [mode, setMode] = useState<"generate" | "custom">("generate");
  const [customPassword, setCustomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setMode("generate");
    setCustomPassword("");
    setConfirmPassword("");
    setRequirePasswordChange(true);
    setSendEmail(false);
    setGeneratedPassword(null);
    setShowPassword(false);
  };

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters" };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Password must contain lowercase letters" };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Password must contain uppercase letters" };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Password must contain numbers" };
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return { valid: false, message: "Password must contain special characters (!@#$%^&*)" };
    }
    return { valid: true };
  };

  const getPasswordStrength = (password: string): string => {
    if (password.length < 8) return "weak";
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    const criteriasMet = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (criteriasMet === 4 && password.length >= 12) return "strong";
    if (criteriasMet >= 3) return "medium";
    return "weak";
  };

  const handleGenerate = async () => {
    if (!manager) return;

    if (mode === "custom") {
      const validation = validatePassword(customPassword);
      if (!validation.valid) {
        toast({
          title: "Invalid Password",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
      if (customPassword !== confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-manager-password", {
        body: {
          managerId: manager.id,
          password: mode === "custom" ? customPassword : undefined,
          requirePasswordChange,
          sendEmail,
        },
      });

      if (error) throw error;

      setGeneratedPassword(data.tempPassword);
      toast({
        title: "Success",
        description: `Temporary password created for ${manager.name}`,
      });
    } catch (error: any) {
      console.error("Error generating password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate temporary password",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  if (!manager) return null;

  const passwordStrength = mode === "custom" ? getPasswordStrength(customPassword) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Temporary Password</DialogTitle>
        </DialogHeader>

        {!generatedPassword ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Manager</Label>
              <div className="text-sm">
                <div className="font-medium">{manager.name}</div>
                <div className="text-muted-foreground">{manager.email}</div>
              </div>
            </div>

            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "generate" | "custom")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="generate" id="generate" />
                <Label htmlFor="generate" className="font-normal cursor-pointer">
                  Generate secure password
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  Set custom password
                </Label>
              </div>
            </RadioGroup>

            {mode === "custom" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                  {customPassword && (
                    <div className="text-xs">
                      Strength:{" "}
                      <span
                        className={
                          passwordStrength === "strong"
                            ? "text-green-600"
                            : passwordStrength === "medium"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }
                      >
                        {passwordStrength?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="require-change"
                  checked={requirePasswordChange}
                  onCheckedChange={(checked) => setRequirePasswordChange(checked as boolean)}
                />
                <Label htmlFor="require-change" className="font-normal cursor-pointer">
                  Require password change on next login
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                />
                <Label htmlFor="send-email" className="font-normal cursor-pointer">
                  Send notification email to manager
                </Label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "generate" ? "Generate" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={generatedPassword}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This password will not be shown again. Make sure to copy it now.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
