import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingsActionRow } from "@/components/settings/SettingsList";
import { sendUpdateBroadcast } from "@/lib/push-notifications";

/** Dev-Button: schickt eine "App aktualisieren"-Push-Notification an alle anderen Accounts. */
export function BroadcastUpdateButton() {
  const [open, setOpen] = useState(false);

  const broadcastMut = useMutation({
    mutationFn: () => sendUpdateBroadcast(),
    onSuccess: (result) => {
      setOpen(false);
      toast.success(`Gesendet: ${result.sent} erreicht, ${result.failed} fehlgeschlagen`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SettingsActionRow
        icon={Send}
        title="App-Update an alle senden"
        onClick={() => setOpen(true)}
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update-Hinweis an alle senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Schickt eine Push-Benachrichtigung ("App aktualisieren") an alle registrierten
              Accounts außer dir. Fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={broadcastMut.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                broadcastMut.mutate();
              }}
              disabled={broadcastMut.isPending}
            >
              {broadcastMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
