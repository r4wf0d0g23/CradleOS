import { useContext } from "react";
import { NotificationContext } from "../providers/NotificationProvider";
import { NotificationContextType } from "../types";

/**
 * Hook for displaying user notifications in EVE Frontier dApps.
 *
 * Provides a simple notification system for displaying success, error, warning,
 * and info messages to users. Commonly used after transaction completions
 * or to display important status updates.
 *
 * @category Hooks - Notification
 * @returns Object containing notification state and methods:
 *   - `notify` - Function to trigger a notification
 *   - `notification` - Current notification state object with:
 *     - `isOpen` - Whether notification is visible
 *     - `message` - The notification message
 *     - `severity` - The notification type (success, error, warning, info)
 *     - `txHash` - Optional transaction hash for linking
 *     - `handleClose` - Function to close the notification
 * @throws {Error} If used outside of `EveFrontierProvider`
 *
 * @example Basic notification
 * ```tsx
 * import { useNotification, Severity } from '@evefrontier/dapp-kit';
 *
 * const MyComponent = () => {
 *   const { notify } = useNotification();
 *
 *   const showSuccess = () => {
 *     notify({ type: Severity.Success, message: 'Operation completed!' });
 *   };
 *
 *   return <button onClick={showSuccess}>Complete</button>;
 * };
 * ```
 *
 * @example Transaction notification with hash
 * ```tsx
 * const { notify } = useNotification();
 *
 * const handleTransaction = async () => {
 *   try {
 *     const result = await sendTransaction();
 *     notify({
 *       type: Severity.Success,
 *       message: 'Transaction successful!',
 *       txHash: result.digest
 *     });
 *   } catch (error) {
 *     notify({
 *       type: Severity.Error,
 *       message: 'Transaction failed'
 *     });
 *   }
 * };
 * ```
 *
 * @example Displaying notification UI
 * ```tsx
 * const { notification } = useNotification();
 *
 * return (
 *   <>
 *     {notification.isOpen && (
 *       <Alert severity={notification.severity} onClose={notification.handleClose}>
 *         {notification.message}
 *       </Alert>
 *     )}
 *   </>
 * );
 * ```
 */
export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within an EveFrontierProvider",
    );
  }
  return context;
}
