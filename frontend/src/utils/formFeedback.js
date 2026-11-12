// Form validation feedback for every form in the app.
// When the browser blocks a submit because a field is invalid (required,
// min, type="email", ...), that field gets a short shake and a red
// highlight until the user edits it.

const SHAKE_CLASS = "lp-shake";
const INVALID_CLASS = "lp-invalid";

export const shake = (element) => {
  if (!element) return;

  element.classList.remove(SHAKE_CLASS);
  // Restart the animation if it is already running
  void element.offsetWidth;
  element.classList.add(SHAKE_CLASS);
};

let installed = false;

export const installFormFeedback = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;

  let lastShakeAt = 0;

  // "invalid" does not bubble, so listen in the capture phase
  document.addEventListener(
    "invalid",
    (event) => {
      const field = event.target;
      if (!(field instanceof HTMLElement)) return;

      field.classList.add(INVALID_CLASS);

      // Shake only the first invalid field of a submit attempt
      const now = Date.now();
      if (now - lastShakeAt > 300) {
        lastShakeAt = now;
        shake(field);
      }
    },
    true
  );

  const clear = (event) => {
    const field = event.target;
    if (field?.classList?.contains(INVALID_CLASS) && field.checkValidity?.()) {
      field.classList.remove(INVALID_CLASS);
    }
  };

  document.addEventListener("input", clear, true);
  document.addEventListener("change", clear, true);

  document.addEventListener(
    "animationend",
    (event) => {
      if (event.animationName === "lp-shake") {
        event.target.classList.remove(SHAKE_CLASS);
      }
    },
    true
  );
};
