"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

export default function VerifyPhonePage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendCode = async () => {
    setIsSending(true);
    try {
      await api.post("/api/auth/phone/send");
      toast.success("Code sent to your phone!");
      startCooldown();
    } catch {
      toast.error("Unable to send code.");
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async (fullCode: string) => {
    setIsVerifying(true);
    try {
      await api.post("/api/auth/phone/verify", { code: fullCode });
      toast.success("Phone verified!");
      router.push("/dashboard");
    } catch {
      toast.error("Invalid or expired code.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newCode.join("");
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      verifyCode(pasted);
    }
  };

  return (
    <AuthLayout
      title="Verify your phone"
      subtitle="Enter the 6-digit code sent to your phone number."
    >
      <div className="flex flex-col items-center py-4">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Smartphone className="size-8 text-primary" />
        </div>

        <div className="mb-6 flex gap-2" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                "size-12 rounded-xl border border-input bg-transparent text-center text-xl font-semibold transition-all outline-none",
                "focus:border-primary focus:ring-3 focus:ring-primary/20",
                "sm:size-14 sm:text-2xl",
              )}
              disabled={isVerifying}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {isVerifying && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Verifying...
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button
          onClick={sendCode}
          variant="outline"
          className="h-12 w-full text-base"
          disabled={isSending || cooldown > 0}
        >
          {isSending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Send Code"}
        </Button>
      </div>
    </AuthLayout>
  );
}
