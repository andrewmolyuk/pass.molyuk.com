const ICON_SVG = `<svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg><svg class="icon-check hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export function createCopyButton(ariaLabel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML = ICON_SVG;
  return btn;
}

export function wireCopyButton(btn, getText) {
  const copyIcon = btn.querySelector('.icon-copy');
  const checkIcon = btn.querySelector('.icon-check');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.classList.add('copied');
      copyIcon.classList.add('hidden');
      checkIcon.classList.remove('hidden');
      setTimeout(() => {
        btn.classList.remove('copied');
        copyIcon.classList.remove('hidden');
        checkIcon.classList.add('hidden');
      }, 1500);
    } catch {
      // clipboard API unavailable — text is already visible for manual copy
    }
  });
}
