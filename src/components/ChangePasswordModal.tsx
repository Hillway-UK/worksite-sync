import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, Lock, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forcedMode?: boolean;
}

export function ChangePasswordModal({ open, onOpenChange, forcedMode = false }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber;
  const canSubmit = currentPassword && newPassword && confirmPassword && isPasswordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.email) return;

    setIsProcessing(true);

    try {
      // Call edge function for secure password change
      const { data, error } = await supabase.functions.invoke("manager-change-password", {
        body: {
          currentPassword,
          newPassword,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      resetForm();
      onOpenChange(false);

      // If this was a forced password change, reload to clear the flag
      if (forcedMode) {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (forcedMode) return; // Cannot close in forced mode
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={forcedMode ? undefined : handleClose}>
      <DialogContent 
        className="sm:max-w-md" 
        onInteractOutside={(e) => forcedMode && e.preventDefault()}
        onEscapeKeyDown={(e) => forcedMode && e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <DialogTitle>Change Password</DialogTitle>
          </div>
          <DialogDescription>
            {forcedMode 
              ? "For security reasons, you must update your password before continuing."
              : "Update your password to keep your account secure."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={isProcessing}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={isProcessing}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your current password or your temporary password if you're updating for the first time.
            </p>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isProcessing}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={isProcessing}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isProcessing}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isProcessing}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Password Requirements */}
          {newPassword && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              <p className="text-sm font-medium">Password Requirements:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {hasMinLength ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={hasMinLength ? "text-green-600" : "text-muted-foreground"}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {hasUpperCase && hasLowerCase ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={hasUpperCase && hasLowerCase ? "text-green-600" : "text-muted-foreground"}>
                    Contains uppercase and lowercase letters
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {hasNumber ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={hasNumber ? "text-green-600" : "text-muted-foreground"}>
                    Contains at least one number
                  </span>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-2 text-xs">
                    {passwordsMatch ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordsMatch ? "text-green-600" : "text-destructive"}>
                      Passwords match
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            {!forcedMode && (
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={!canSubmit || isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
