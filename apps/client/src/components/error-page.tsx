import { isRouteErrorResponse, useRouteError } from "react-router";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Ersetzt die Standard-Fehlerseite von React Router bei unerwarteten Fehlern. */
export function ErrorPage() {
  const error = useRouteError();
  const { t } = useI18n();
  if (import.meta.env.DEV) console.error(error);
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : null;

  return (
    <div className="grid min-h-svh place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="bg-muted grid size-12 place-items-center rounded-xl border">
          <TriangleAlert className="size-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t.errorPage.title}</h1>
          <p className="text-muted-foreground text-sm">{t.errorPage.text}</p>
          {detail && <p className="text-muted-foreground font-mono text-xs">{detail}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw /> {t.errorPage.reload}
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/")}>
            {t.errorPage.home}
          </Button>
        </div>
      </div>
    </div>
  );
}
