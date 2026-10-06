import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ConfirmDialog from "./ConfirmDialog";
import {
  ConfirmContext,
  type Confirm,
  type ConfirmOptions,
} from "./useConfirm";

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm: Confirm = useCallback(
    (nextOptions) =>
      new Promise<boolean>((resolve) => {
        // Superseding a confirmation cancels the previous action; only one dialog is shown.
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(nextOptions);
      }),
    [],
  );

  const finish = useCallback((confirmed: boolean) => {
    const resolve = resolver.current;
    if (!resolve) return;
    resolver.current = null;
    setOptions(null);
    resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        title={options?.title ?? ""}
        description={options?.description}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        variant={options?.variant}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmContext.Provider>
  );
}
