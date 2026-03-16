import { ReactNode, createContext, useCallback, useState } from "react";

import { Severity } from "../types";
import { NotificationContextType, NotificationState } from "../types";

/** @category Providers */
export const NotificationContext = createContext<NotificationContextType>({
  notify: () => {},
  notification: {
    message: "",
    txHash: "",
    severity: Severity.Success,
    handleClose: () => {},
    isOpen: false,
  },
  handleClose: () => {},
});

/**
 * NotificationProvider manages notifications for transactions and messages.
 *
 * @category Providers
 */
const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [severity, setSeverity] = useState<Severity>(Severity.Info);
  const [txHash, setTxHash] = useState<string>("");

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const notify = useCallback(
    ({
      type,
      message,
      txHash,
    }: {
      type: Severity;
      message?: string;
      txHash?: string;
    }) => {
      setSeverity(type);
      setIsOpen(true);

      // If success with txHash, show success message with transaction hash
      if (type === Severity.Success && txHash) {
        setMessage(
          `Transaction was successful. ${message ?? ""} Transaction hash: ${txHash}`,
        );
        setTxHash(txHash);
        return;
      }

      // Otherwise, show the passed message or a default based on severity
      if (message) {
        setMessage(message);
      } else {
        switch (type) {
          case Severity.Success:
            setMessage("Operation completed successfully.");
            break;
          case Severity.Error:
            setMessage("An error occurred.");
            break;
          case Severity.Warning:
            setMessage("Warning.");
            break;
          case Severity.Info:
          default:
            setMessage("Processing...");
            break;
        }
      }
      setTxHash(txHash ?? "");
    },
    [],
  );

  const notification: NotificationState = {
    message,
    txHash,
    severity,
    handleClose,
    isOpen,
  };

  return (
    <NotificationContext.Provider value={{ notify, handleClose, notification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
