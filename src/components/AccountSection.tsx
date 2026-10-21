import { useState } from "react";
import {
  CreditCard,
  Download,
  Loader2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

function Panel({ children }: { children?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      {children}
    </section>
  );
}

/** E-Mail-Adresse ändern. */
export function EmailPanel() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (email.trim() !== confirm.trim()) {
      toast.error("E-Mail-Adressen stimmen nicht überein");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bestätigungs-Mail versendet");
    setEmail("");
    setConfirm("");
  }

  return (
    <Panel>
      <div>
        <p className="text-sm font-semibold">Aktuelle E-Mail</p>
        <p className="text-xs text-muted-foreground">{user?.email ?? "Nicht angemeldet"}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-email">Neue E-Mail</Label>
        <Input
          id="new-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-email-confirm">Neue E-Mail bestätigen</Label>
        <Input
          id="new-email-confirm"
          type="email"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button className="w-full" onClick={submit} disabled={pending || !email.trim()}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
      <p className="text-xs text-muted-foreground">
        Du erhältst eine Bestätigungs-Mail an die neue Adresse.
      </p>
    </Panel>
  );
}

/** Passwort ändern. */
export function PasswordPanel() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pw.length < 8) {
      toast.error("Mindestens 8 Zeichen");
      return;
    }
    if (pw !== confirm) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Passwort geändert");
    setPw("");
    setConfirm("");
  }

  return (
    <Panel>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">Neues Passwort</Label>
        <Input
          id="new-pw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw-confirm">Passwort bestätigen</Label>
        <Input
          id="new-pw-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button className="w-full" onClick={submit} disabled={pending || !pw}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
      <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
    </Panel>
  );
}

/**
 * Konto löschen: Platzhalter. Die Funktion lief früher über den Cloudflare-Worker und muss
 * noch auf die NAS-API migriert werden (siehe nas-api/src/index.js, Route /account/delete).
 */
export function DeleteAccountPanel() {
  return (
    <Panel>
      <p className="text-sm font-semibold">Konto löschen</p>
      <p className="text-xs text-muted-foreground">
        Diese Funktion ist vorübergehend nicht verfügbar. Sie wird gerade auf das neue System
        migriert und kommt in einem späteren Update zurück. Wenn du dein Konto jetzt löschen
        lassen möchtest, wende dich bitte an den Admin.
      </p>
    </Panel>
  );
}

/** Datenexport anfordern. */
export function ExportPanel() {
  return (
    <Panel>
      <p className="text-xs text-muted-foreground">
        Lade eine Kopie deiner Rezepte und Planer-Daten herunter.
      </p>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => toast.info("Feature folgt in Kürze")}
      >
        <Download className="mr-2 h-4 w-4" />
        Export anfordern
      </Button>
    </Panel>
  );
}

/** Zahlungsmethode und Rechnungen (nur bei aktivem Premium). */
export function BillingPanel() {
  return (
    <Panel>
      <p className="text-xs text-muted-foreground">
        Verwalte Zahlungsmethode und Rechnungen.
      </p>
      <Button variant="outline" className="w-full">
        <CreditCard className="mr-2 h-4 w-4" />
        Zahlungsmethode verwalten
      </Button>
      <Button variant="outline" className="w-full">
        <Receipt className="mr-2 h-4 w-4" />
        Rechnungen ansehen
      </Button>
    </Panel>
  );
}
