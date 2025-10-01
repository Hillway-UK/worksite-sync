import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const validatePassword = () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return false;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error("Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one number");
      return false;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user?.email || !currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!validatePassword()) return;

    setIsProcessing(true);

    try {
      console.log("Starting password change process...");
      
      // Re-authenticate with current password
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (reauthErr) {
        console.error("Re-authentication failed:", reauthErr);
        toast.error("Current password is incorrect");
        setIsProcessing(false);
        return;
      }

      console.log("Re-authentication successful");

      // Get access token
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        console.error("Failed to get session:", sessErr);
        toast.error("Unable to get a valid session. Please sign in again.");
        setIsProcessing(false);
        return;
      }

      console.log("Session retrieved, calling edge function...");

      // Call edge function to update password with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timeout")), 15000)
      );

      const functionPromise = supabase.functions.invoke("manager-change-password", {
        body: { newPassword },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      const result = await Promise.race([functionPromise, timeoutPromise]) as any;
      const { data, error } = result;

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message ?? "Password update failed");
      }
      if (data?.error) {
        console.error("Edge function returned error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.ok) {
        console.error("Unexpected response format:", data);
        throw new Error("Invalid response from server");
      }

      console.log("Password updated successfully");
      toast.success("Password updated successfully");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error changing password:", err);
      
      let errorMessage = "Failed to change password";
      if (err.message === "Request timeout") {
        errorMessage = "Request timed out. Please try again.";
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <DialogTitle>Change Password</DialogTitle>
          </div>
          <DialogDescription>
            Update your password to keep your account secure.
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
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </p>
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

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isProcessing}>
              Update Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
