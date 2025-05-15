export function createSignal<T = undefined>() {
  let resolve = (value: T) => {};
  let reject = (reason?: any) => {};
  const controls = { resolve, reject };

  const instance = new Promise((resolve, reject) => {
    controls.resolve = resolve;
    controls.reject = reject;
  });

  return { instance, ...controls };
}
