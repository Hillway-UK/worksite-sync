import React, { useState } from "react";
import { Key, Copy, Check, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ResetPasswordModalProps {
  manager: {
    id: string;
    name: string;
    email: string;
  };
  onSuccess?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ manager, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [sendNotificationEmail, setSendNotificationEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setOpen(false);
    setUseCustomPassword(false);
    setCustomPassword("");
    setRequirePasswordChange(true);
    setSendNotificationEmail(true);
    setGeneratedPassword(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-manager-password", {
        body: {
          managerId: manager.id,
          useCustomPassword,
          customPassword: useCustomPassword ? customPassword : undefined,
          requirePasswordChange,
          sendNotificationEmail,
        },
      });

      if (error) throw error;

      setGeneratedPassword(data.temporaryPassword);

      toast({
        title: "Success",
        description: `Temporary password created for ${manager.name}`,
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Key className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate temp password</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Manager Password</DialogTitle>
          <DialogDescription>
            Generate a temporary password for {manager.name}
          </DialogDescription>
        </DialogHeader>

        {!generatedPassword ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Manager Details</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Name:</span> {manager.name}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {manager.email}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useCustomPassword"
                  checked={useCustomPassword}
                  onCheckedChange={(checked) => setUseCustomPassword(checked as boolean)}
                />
                <Label htmlFor="useCustomPassword" className="text-sm font-normal cursor-pointer">
                  Set custom password
                </Label>
              </div>

              {useCustomPassword && (
                <div className="space-y-2">
                  <Label htmlFor="customPassword">Custom Password</Label>
                  <div className="relative">
                    <Input
                      id="customPassword"
                      type={showCustomPassword ? "text" : "password"}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter custom password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomPassword(!showCustomPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCustomPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with uppercase, lowercase, number, and symbol
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireChange"
                  checked={requirePasswordChange}
                  onCheckedChange={(checked) => setRequirePasswordChange(checked as boolean)}
                />
                <Label htmlFor="requireChange" className="text-sm font-normal cursor-pointer">
                  Require password change on next login
                </Label>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="sendEmail" className="text-sm font-normal">
                  Send notification email
                </Label>
                <Switch
                  id="sendEmail"
                  checked={sendNotificationEmail}
                  onCheckedChange={setSendNotificationEmail}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Generating..." : "Generate Password"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900 mb-2">
                Temporary password generated successfully!
              </p>
              <p className="text-xs text-green-700">
                {sendNotificationEmail
                  ? "An email has been sent to the manager with login instructions."
                  : "Please share this password securely with the manager."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Temporary Password (one-time display)</Label>
              <div className="flex gap-2">
                <Input value={generatedPassword} readOnly className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-destructive">
                ⚠️ This password will not be shown again. Copy it now or the manager can check
                their email.
              </p>
            </div>

            <Button onClick={handleReset} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
