import { toast } from 'sonner';

export function useToast() {
  return {
    toast: (message: string, options?: { description?: string; variant?: 'default' | 'success' | 'error' | 'warning' }) => {
      const variant = options?.variant;
      if (variant === 'success') {
        toast.success(message, options);
      } else if (variant === 'error') {
        toast.error(message, options);
      } else if (variant === 'warning') {
        toast.warning(message, options);
      } else {
        toast(message, options);
      }
    },
  };
}
