import type { ReactNode } from "react";
import { Loader2, LogIn, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/** Zeigt den Inhalt nur angemeldeten Spielern, sonst einen Hinweis mit Anmelde-Button. */
export function AuthGate({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { user, loading, requireLogin } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="grid min-h-[50svh] place-items-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }
  if (user) return <>{children}</>;
  return (
    <Card className="mx-auto mt-8 max-w-md text-center">
      <CardHeader className="items-center">
        <div className="bg-muted mx-auto mb-2 grid size-12 place-items-center rounded-xl border">
          <Icon className="size-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => requireLogin()}>
          <LogIn /> {t.header.login}
        </Button>
      </CardContent>
    </Card>
  );
}
