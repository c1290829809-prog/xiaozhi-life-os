const modal = document.querySelector('[data-modal]');
const input = document.querySelector('#capture-input');
const result = document.querySelector('[data-capture-result]');
const openButtons = document.querySelectorAll('[data-open-capture]');
const closeButton = document.querySelector('[data-close-capture]');
const submitButton = document.querySelector('[data-submit-capture]');

function openCapture() {
  modal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => input.focus(), 40);
}

function closeCapture() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

openButtons.forEach((button) => button.addEventListener('click', openCapture));
closeButton.addEventListener('click', closeCapture);
modal.addEventListener('click', (event) => { if (event.target === modal) closeCapture(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeCapture();
  if (event.key === 'Enter' && event.shiftKey) return;
  if (event.key === 'Enter' && document.activeElement === input) { event.preventDefault(); submitCapture(); }
});

function submitCapture() {
  const value = input.value.trim();
  if (!value) { input.focus(); return; }
  result.hidden = false;
  submitButton.textContent = '已接住 ✓';
  submitButton.disabled = true;
  input.setAttribute('aria-label', '已记录的想法');
}

submitButton.addEventListener('click', submitCapture);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
}, { threshold: 0.16 });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
