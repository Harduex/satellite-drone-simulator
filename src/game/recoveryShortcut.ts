export function isRecoveryShortcut(event: KeyboardEvent): boolean {
  if (event.code !== 'Space' || event.repeat || event.defaultPrevented
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const target = event.target;
  return !(target instanceof Element && target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}
