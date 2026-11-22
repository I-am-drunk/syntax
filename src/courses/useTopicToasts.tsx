import { useEffect, useId, useRef } from 'react'
import { Toaster, toast } from 'sonner'
export function useTopicToasts() {
  const id = useId(), active = useRef(new Set<string | number>())
  useEffect(() => () => { active.current.forEach(key => toast.dismiss(key)); active.current.clear() }, [])
  function notify(pinned: boolean) {
    const key = (pinned ? toast.success : toast)(pinned
      ? 'Added to your learning paths' : 'Removed from your topics', {
      toasterId: id, duration: 2000,
      onDismiss: item => active.current.delete(item.id),
      onAutoClose: item => active.current.delete(item.id),
    })
    active.current.add(key)
  }
  const toaster = <Toaster id={id} position="bottom-center" icons={{ success:
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M15.0709 4.11099L13.6566 2.69678L5.87845 10.475L2.34292 6.93946L0.928711 8.35367L5.87846 13.3034L15.0709 4.11099Z" fill="currentColor" />
    </svg> }} toastOptions={{ unstyled: true, classNames: {
      toast: 'topic-toast', content: 'topic-toast-content', title: 'topic-toast-title', icon: 'topic-toast-icon',
    } }} />
  return { notify, toaster }
}
