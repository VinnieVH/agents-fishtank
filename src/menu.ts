const menu = document.getElementById('menu') as HTMLDialogElement;

document.getElementById('menu-btn')!.addEventListener('click', () => { if (!menu.open) menu.showModal(); });
// closes before the option's own handler runs, so the page or dialog it opens isn't stacked on the menu
menu.addEventListener('click', event => {
  if (event.target === menu || (event.target instanceof HTMLButtonElement)) menu.close();
}, true);