import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DEFAULT_MODE } from "@2t2m/shared";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAd } from "@/components/ads";
import { AuthGate } from "@/components/auth-gate";
import { MatchRow } from "@/components/match-row";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function HistoryPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["history", DEFAULT_MODE, page],
    queryFn: () => api.history(DEFAULT_MODE, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(user),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Verlauf</h1>
        <p className="text-muted-foreground mt-1">Alle deine Duelle im Überblick.</p>
      </div>
      <AuthGate icon={History} title="Dein Verlauf" description="Melde dich an, um alle deine Duelle zu sehen.">
        <Card>
          <CardHeader>
            <CardTitle>Flaggen & Umrisse</CardTitle>
            <CardDescription>{data ? `${data.total} Duelle insgesamt` : " "}</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-3">
            {isLoading ? (
              <div className="space-y-2 px-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data?.items.length ? (
              <div className="divide-y divide-border/50">
                {data.items.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">Noch keine Duelle gespielt.</p>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 px-3 pt-4">
                <span className="text-muted-foreground mr-2 text-sm">
                  Seite {page} von {pages}
                </span>
                <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <InlineAd />
      </AuthGate>
    </div>
  );
}
