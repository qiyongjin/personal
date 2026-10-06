import { createContext, useContext, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;
export const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm)
    throw new Error("useConfirm must be used within ConfirmProvider");
  return confirm;
}
