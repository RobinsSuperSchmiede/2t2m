import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Flag, Map, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  { icon: Timer, title: "60 Sekunden", text: "Wer mehr richtig hat, gewinnt." },
  { icon: Trophy, title: "Ranked", text: "Elo-Punkte, Stufen, Rangliste." },
  { icon: Flag, title: "Flaggen", text: "Fast 200 Länder." },
  { icon: Map, title: "Umrisse", text: "Erkenne Länder an der Form." },
];

export function LoginPage() {
  const { loginGoogle, loginDev } = useAuth();
  const config = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig, staleTime: Infinity });
  const [devName, setDevName] = useState("");

  return (
    <div className="app-bg grid min-h-svh place-items-center px-4 py-12">
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <Logo className="text-lg" />
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Fordere andere heraus.
            <br />
            <span className="from-primary bg-gradient-to-r to-fuchsia-400 bg-clip-text text-transparent">
              Steig in der Rangliste auf.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md text-lg">
            Echtzeit-Duelle gegen Spieler auf deinem Niveau. Starte mit Geografie – weitere Themen folgen.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="bg-card/60 rounded-xl border p-4 backdrop-blur"
              >
                <Icon className="text-primary mb-2 size-5" />
                <div className="font-semibold">{title}</div>
                <div className="text-muted-foreground text-sm">{text}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <Card className="mx-auto w-full max-w-sm shadow-2xl shadow-black/40">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Willkommen</CardTitle>
              <CardDescription>Melde dich an, um dein erstes Duell zu starten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex min-h-11 justify-center">
                {config.data?.googleClientId ? (
                  <GoogleLogin
                    theme="filled_black"
                    shape="pill"
                    size="large"
                    text="continue_with"
                    onSuccess={(res) => {
                      if (res.credential) {
                        loginGoogle(res.credential).catch(() => toast.error("Anmeldung fehlgeschlagen"));
                      }
                    }}
                    onError={() => void toast.error("Google-Anmeldung abgebrochen")}
                  />
                ) : (
                  config.data && (
                    <p className="text-muted-foreground text-center text-sm">
                      Google-Login ist nicht konfiguriert. Setze <code className="font-mono">GOOGLE_CLIENT_ID</code> in
                      der <code className="font-mono">server/.env</code>.
                    </p>
                  )
                )}
              </div>

              {config.data?.devLogin && (
                <>
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-muted-foreground text-xs uppercase">Entwicklung</span>
                    <Separator className="flex-1" />
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      loginDev(devName).catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    <Input placeholder="Testname" value={devName} onChange={(e) => setDevName(e.target.value)} />
                    <Button type="submit" variant="secondary" disabled={devName.trim().length < 2}>
                      Login
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
