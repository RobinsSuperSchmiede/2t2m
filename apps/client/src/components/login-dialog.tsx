import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { loginGoogle, loginDev } = useAuth();
  const config = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig, staleTime: Infinity });
  const [devName, setDevName] = useState("");
  const { t, fmt, errorText } = useI18n();
  const { theme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="bg-primary text-primary-foreground mb-2 grid size-10 place-items-center rounded-lg">
            <Swords className="size-5" />
          </div>
          <DialogTitle>{t.auth.title}</DialogTitle>
          <DialogDescription>{t.auth.description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-11 justify-center pt-2">
          {config.data?.googleClientId ? (
            <GoogleLogin
              theme={theme === "dark" ? "filled_black" : "outline"}
              shape="rectangular"
              size="large"
              text="continue_with"
              onSuccess={(res) => {
                if (res.credential) {
                  loginGoogle(res.credential).catch(() => toast.error(t.auth.failed));
                }
              }}
              onError={() => void toast.error(t.auth.googleCancelled)}
            />
          ) : (
            config.data && (
              <p className="text-muted-foreground text-center text-sm">
                {fmt(t.auth.googleNotConfigured, { key: "GOOGLE_CLIENT_ID", file: "server/.env" })}
              </p>
            )
          )}
        </div>

        {config.data?.devLogin && (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs uppercase">{t.auth.development}</span>
              <Separator className="flex-1" />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                loginDev(devName).catch((err: Error) => toast.error(errorText(err)));
              }}
            >
              <Input placeholder={t.auth.testName} value={devName} onChange={(e) => setDevName(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={devName.trim().length < 2}>
                {t.auth.login}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
