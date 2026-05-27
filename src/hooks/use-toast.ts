import { useNotify } from "@/components/ui/notification";

export function useToast() {
  const { notify } = useNotify();

  const toast = ({
    title,
    description,
    variant,
  }: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => {
    notify(description || title, variant === "destructive" ? "error" : "success");
  };

  return { toast };
}
