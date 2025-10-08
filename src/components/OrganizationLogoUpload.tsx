import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

interface OrganizationLogoUploadProps {
  organizationId: string;
  currentLogoUrl?: string | null;
  onUploadComplete: (logoUrl: string) => void;
  onDeleteComplete?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export function OrganizationLogoUpload({
  organizationId,
  currentLogoUrl,
  onUploadComplete,
  onDeleteComplete,
}: OrganizationLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Please upload a PNG, JPG, or WEBP image file.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 5MB.";
    }
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid File",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Get file extension
      const fileExt = file.name.split(".").pop();
      const filePath = `${organizationId}/logo.${fileExt}`;

      // Delete existing logo if present
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("organization-logos").remove([oldPath]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update organization record
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ logo_url: publicUrl })
        .eq("id", organizationId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onUploadComplete(publicUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully.",
      });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!currentLogoUrl) return;

    setDeleting(true);

    try {
      // Extract file path from URL
      const filePath = currentLogoUrl.split("/").slice(-2).join("/");

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from("organization-logos")
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update organization record
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ logo_url: null })
        .eq("id", organizationId);

      if (updateError) throw updateError;

      setPreviewUrl(null);
      onDeleteComplete?.();

      toast({
        title: "Success",
        description: "Logo removed successfully.",
      });
    } catch (error: any) {
      console.error("Error deleting logo:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="logo-upload" className="text-sm font-medium">
          Organization Logo <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a logo (PNG, JPG, or WEBP, max 5MB)
        </p>
      </div>

      {previewUrl && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex-shrink-0">
            <img
              src={previewUrl}
              alt="Organization logo preview"
              className="h-16 w-auto max-w-[200px] object-contain rounded"
            />
          </div>
          <div className="flex-1" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || uploading}
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          id="logo-upload"
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading || deleting}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
        >
          {uploading ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              {previewUrl ? "Replace Logo" : "Upload Logo"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
