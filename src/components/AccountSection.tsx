import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CreditCard,
  Download,
  Loader2,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { isNativeApp } from "@/lib/platform";

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

const DELETE_PHRASE = "LÖSCHEN";

/** Account endgültig löschen – mit Bestätigungs-Eingabe. */
export function DeleteAccountPanel() {
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const deleteFn = useServerFn(deleteMyAccount);

  const mutation = useMutation({
    mutationFn: () => deleteFn({ data: undefined }),
    onSuccess: async () => {
      toast.success("Account gelöscht");
      await supabase.auth.signOut();
      void navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isNativeApp()) {
    return (
      <Panel>
        <p className="text-sm font-semibold">Konto löschen</p>
        <p className="text-xs text-muted-foreground">
          In der App-Version aktuell nicht verfügbar. Bitte über die Website löschen.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div>
        <p className="text-sm font-semibold text-destructive">
          Wirklich unwiderruflich löschen?
        </p>
        <p className="text-xs text-muted-foreground">
          Alle Rezepte, Planer-Einträge und Profildaten werden unwiderruflich gelöscht.
          Diese Aktion kann nicht rückgängig gemacht werden. Tippe „{DELETE_PHRASE}" ein,
          um zu bestätigen.
        </p>
      </div>
      <Input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={DELETE_PHRASE}
        aria-label="Bestätigung"
      />
      <Button
        variant="destructive"
        className="w-full"
        disabled={phrase.trim() !== DELETE_PHRASE || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Endgültig löschen
      </Button>
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
