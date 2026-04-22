"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, Trash2, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.get("/api/me/data-export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kindredcare-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully.");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/api/me");
      useAuthStore.getState().clearAuth();
      toast.success("Account deleted.");
      router.push("/");
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      const res = await api.post("/api/me/logout-all");
      useAuthStore.getState().setAuth(user!, res.data.token);
      toast.success("All other sessions have been revoked.");
    } catch {
      toast.error("Failed to revoke sessions.");
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6">Settings</h1>

      {/* Account info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{user?.role}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{user?.phone || "Not set"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>Manage your active sessions across devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogoutAll}
            disabled={isLoggingOutAll}
          >
            {isLoggingOutAll ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Shield className="mr-2 size-4" />
            )}
            Log out all other devices
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 size-4" />
            Log out
          </Button>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data & Privacy</CardTitle>
          <CardDescription>Export your data or delete your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Export my data
          </Button>

          <Dialog>
            <DialogTrigger
              render={
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 size-4" />
                  Delete my account
                </Button>
              }
            />
            <DialogContent>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. All your data will be permanently deleted within 30
                days. Financial records will be retained for 7 years per CRA requirements.
              </DialogDescription>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Yes, delete my account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
