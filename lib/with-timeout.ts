/** Race a promise; resolve null on timeout so UI never hangs forever. */
export function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, ms);
    promise
      .then((v) => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(v);
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(null);
        }
      });
  });
}
