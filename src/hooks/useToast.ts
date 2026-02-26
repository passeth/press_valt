import { useToastStore } from "@/stores/toast";

export function useToast() {
  const add = useToastStore((s) => s.add);
  return { toast: add };
}
